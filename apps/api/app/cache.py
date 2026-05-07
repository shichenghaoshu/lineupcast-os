"""In-memory caching layer with TTL support.

Provides:
- A thread-safe ``CacheStore`` singleton that stores entries with per-key TTLs.
- A ``cached`` decorator for service-layer functions.
- ``invalidate`` / ``invalidate_prefix`` helpers for write-path cache busting.
- Middleware that adds ``X-Cache`` / ``X-Cache-TTL`` headers to responses.
"""

from __future__ import annotations

import functools
import hashlib
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Callable

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cache store
# ---------------------------------------------------------------------------


class CacheEntry:
    """A single cached value with an expiry timestamp."""

    __slots__ = ("value", "expires_at", "created_at")

    def __init__(self, value: Any, ttl: float) -> None:
        self.value = value
        self.created_at = time.monotonic()
        self.expires_at = self.created_at + ttl

    @property
    def is_expired(self) -> bool:
        return time.monotonic() >= self.expires_at

    @property
    def remaining_ttl(self) -> float:
        return max(0.0, self.expires_at - time.monotonic())


class CacheStore:
    """Thread-safe, bounded, TTL-based in-memory cache.

    Entries are stored in an ``OrderedDict`` for O(1) ordered access.
    Expired entries are lazily evicted on access and periodically pruned.
    """

    def __init__(self, max_size: int = 2048) -> None:
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.Lock()
        self._max_size = max_size
        # Counters for observability
        self.hits = 0
        self.misses = 0

    # -- public API ---------------------------------------------------------

    def get(self, key: str) -> tuple[bool, Any]:
        """Return ``(hit, value)`` for *key*."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self.misses += 1
                return False, None
            if entry.is_expired:
                del self._store[key]
                self.misses += 1
                return False, None
            # Move to end (most-recently used)
            self._store.move_to_end(key)
            self.hits += 1
            return True, entry.value

    def set(self, key: str, value: Any, ttl: float) -> None:
        """Store *value* under *key* for *ttl* seconds."""
        with self._lock:
            if key in self._store:
                del self._store[key]
            elif len(self._store) >= self._max_size:
                # Evict oldest entry
                self._store.popitem(last=False)
            self._store[key] = CacheEntry(value, ttl)

    def remaining_ttl(self, key: str) -> float | None:
        """Return remaining TTL for *key* in seconds, or ``None`` if absent/expired."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None or entry.is_expired:
                return None
            return entry.remaining_ttl

    def delete(self, key: str) -> bool:
        """Remove *key*. Returns ``True`` if it existed."""
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def delete_prefix(self, prefix: str) -> int:
        """Remove all keys starting with *prefix*. Returns count removed."""
        with self._lock:
            to_remove = [k for k in self._store if k.startswith(prefix)]
            for k in to_remove:
                del self._store[k]
            return len(to_remove)

    def clear(self) -> None:
        """Drop all entries."""
        with self._lock:
            self._store.clear()

    def prune(self) -> int:
        """Remove all expired entries. Returns count removed."""
        with self._lock:
            to_remove = [k for k, v in self._store.items() if v.is_expired]
            for k in to_remove:
                del self._store[k]
            return len(to_remove)

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)

    @property
    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "size": self.size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total, 4) if total else 0.0,
        }


# Module-level singleton
_store = CacheStore()


def get_cache() -> CacheStore:
    """Return the module-level cache singleton (useful for testing / DI)."""
    return _store


# ---------------------------------------------------------------------------
# Key builder helpers
# ---------------------------------------------------------------------------


def _make_key(prefix: str, *args: Any, **kwargs: Any) -> str:
    """Build a deterministic cache key from a prefix and call arguments."""
    parts = [str(a) for a in args]
    parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    suffix = hashlib.md5("|".join(parts).encode()).hexdigest()[:12]
    return f"{prefix}:{suffix}"


# ---------------------------------------------------------------------------
# Decorator
# ---------------------------------------------------------------------------


def cached(prefix: str, ttl: float) -> Callable:
    """Decorator that caches the return value of a function.

    Parameters
    ----------
    prefix:
        A human-readable namespace for the cache key, e.g. ``"matches"``.
    ttl:
        Time-to-live in **seconds**.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = _make_key(prefix, *args, **kwargs)
            hit, value = _store.get(key)
            if hit:
                logger.debug("cache HIT  %s", key)
                return value
            logger.debug("cache MISS %s", key)
            result = func(*args, **kwargs)
            _store.set(key, result, ttl)
            return result

        # Expose helpers so route handlers can bust the cache
        wrapper.invalidate = lambda *a, **kw: _store.delete(  # type: ignore[attr-defined]
            _make_key(prefix, *a, **kw)
        )
        wrapper.invalidate_prefix = lambda: _store.delete_prefix(prefix)  # type: ignore[attr-defined]
        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Convenience invalidation helpers (module-level)
# ---------------------------------------------------------------------------


def invalidate(key: str) -> bool:
    """Invalidate a single cache key."""
    return _store.delete(key)


def invalidate_prefix(prefix: str) -> int:
    """Invalidate all keys starting with *prefix*."""
    return _store.delete_prefix(prefix)


def clear_all() -> None:
    """Drop every cached entry."""
    _store.clear()


# ---------------------------------------------------------------------------
# Middleware: inject X-Cache headers
# ---------------------------------------------------------------------------


class CacheHeaderMiddleware(BaseHTTPMiddleware):
    """Middleware that adds ``X-Cache`` and ``X-Cache-TTL`` headers.

    The middleware looks for a ``cache_info`` key set on
    ``request.state`` by the route handler.  The value should be a dict
    with ``hit`` (bool), ``ttl`` (float, remaining seconds), and
    ``key`` (str) entries.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        info = getattr(request.state, "cache_info", None)
        if info is not None:
            response.headers["X-Cache"] = "HIT" if info.get("hit") else "MISS"
            ttl_remaining = info.get("ttl")
            if ttl_remaining is not None:
                response.headers["X-Cache-TTL"] = str(int(ttl_remaining))
            key = info.get("key")
            if key:
                response.headers["X-Cache-Key"] = key
        return response
