"""In-memory rate limiter using the token bucket algorithm.

Provides per-client, per-path rate limiting with configurable limits.
Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
are added to every response.  Requests that exceed the limit receive a
429 Too Many Requests response.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse


# ---------------------------------------------------------------------------
# Token bucket
# ---------------------------------------------------------------------------

@dataclass
class _Bucket:
    """A single token-bucket state for one (client, path) pair."""

    capacity: float
    refill_rate: float  # tokens per second
    tokens: float = 0.0
    last_refill: float = field(default_factory=time.monotonic)

    # -- public helpers -------------------------------------------------------

    def consume(self) -> tuple[bool, float, float]:
        """Try to consume one token.

        Returns (allowed, remaining, seconds_until_reset).
        """
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            remaining = int(self.tokens)
            return True, remaining, 0.0

        # How long until a token is available?
        deficit = 1.0 - self.tokens
        wait = deficit / self.refill_rate
        return False, 0, wait


# ---------------------------------------------------------------------------
# Public configuration dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RateLimitRule:
    """Describes the rate limit for a set of paths."""

    requests: int  # max requests per window
    window_seconds: int = 60  # rolling window size
    paths: tuple[str, ...] = ()  # empty tuple means "default / catch-all"

    @property
    def refill_rate(self) -> float:
        return self.requests / self.window_seconds

    @property
    def capacity(self) -> float:
        return float(self.requests)


# ---------------------------------------------------------------------------
# Per-endpoint overrides (path pattern -> rule)
# ---------------------------------------------------------------------------

# Heavier endpoints (script generation, prediction, backtest) get tighter limits.
ENDPOINT_LIMITS: dict[str, RateLimitRule] = {
    "/api/matches/{match_id}/scripts/generate": RateLimitRule(requests=10, window_seconds=60),
    "/api/matches/{match_id}/predict": RateLimitRule(requests=20, window_seconds=60),
    "/api/matches/{match_id}/prediction": RateLimitRule(requests=30, window_seconds=60),
    "/api/matches/import": RateLimitRule(requests=10, window_seconds=60),
    "/api/providers/test": RateLimitRule(requests=10, window_seconds=60),
    "/api/providers/sync": RateLimitRule(requests=5, window_seconds=60),
    "/api/snapshots": RateLimitRule(requests=20, window_seconds=60),
    "/api/models/backtest": RateLimitRule(requests=10, window_seconds=60),
}

# Global default if no endpoint-specific rule matches.
DEFAULT_RATE_LIMIT = RateLimitRule(requests=60, window_seconds=60)


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

class RateLimitStore:
    """Thread-safe (GIL) in-memory store of token buckets.

    Buckets are keyed by ``(client_key, path_pattern)``.  Stale entries are
    pruned on every ``get_bucket`` call to avoid unbounded memory growth.
    """

    def __init__(self, prune_interval: float = 300.0) -> None:
        self._buckets: dict[tuple[str, str], _Bucket] = {}
        self._last_prune: float = time.monotonic()
        self._prune_interval = prune_interval

    def get_bucket(self, client_key: str, rule: RateLimitRule) -> _Bucket:
        key = (client_key, rule.paths[0] if rule.paths else "__default__")
        bucket = self._buckets.get(key)
        if bucket is None or bucket.capacity != rule.capacity:
            bucket = _Bucket(
                capacity=rule.capacity,
                refill_rate=rule.refill_rate,
                tokens=rule.capacity,  # start full
            )
            self._buckets[key] = bucket
        self._maybe_prune()
        return bucket

    # -- housekeeping ---------------------------------------------------------

    def _maybe_prune(self) -> None:
        now = time.monotonic()
        if now - self._last_prune < self._prune_interval:
            return
        self._last_prune = now
        stale_keys = [
            k for k, b in self._buckets.items()
            if now - b.last_refill > self._prune_interval
        ]
        for k in stale_keys:
            del self._buckets[k]


# Module-level singleton so all requests share the same store.
_store = RateLimitStore()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _client_key(request: Request) -> str:
    """Derive a client identifier from the request (IP, or X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _match_path(path: str) -> RateLimitRule:
    """Match the request path against ENDPOINT_LIMITS, returning the best rule.

    Exact matches are preferred; segment-count matches are used as a fallback
    so ``/api/matches/abc123/predict`` matches the key
    ``/api/matches/{match_id}/predict``.
    """
    # Exact match first.
    if path in ENDPOINT_LIMITS:
        return ENDPOINT_LIMITS[path]

    # Segment-count match: replace the variable segment with {placeholder}.
    segments = path.strip("/").split("/")
    for pattern, rule in ENDPOINT_LIMITS.items():
        pattern_segs = pattern.strip("/").split("/")
        if len(pattern_segs) != len(segments):
            continue
        if all(p == s or (p.startswith("{") and p.endswith("}")) for p, s in zip(pattern_segs, segments)):
            return rule

    return DEFAULT_RATE_LIMIT


# ---------------------------------------------------------------------------
# Starlette middleware
# ---------------------------------------------------------------------------

class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI/Starlette middleware that enforces per-client token-bucket limits.

    Usage::

        from app.rate_limiter import RateLimitMiddleware
        app.add_middleware(RateLimitMiddleware)
    """

    def __init__(
        self,
        app,
        *,
        store: RateLimitStore | None = None,
        client_key_fn: Callable[[Request], str] | None = None,
        skip_paths: frozenset[str] | None = None,
    ) -> None:
        super().__init__(app)
        self._store = store or _store
        self._client_key_fn = client_key_fn or _client_key
        # Health endpoints are excluded from rate limiting.
        self._skip_paths = skip_paths or frozenset({"/healthz", "/health", "/readyz"})

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Skip exempt paths (health checks).
        if path in self._skip_paths:
            return await call_next(request)

        rule = _match_path(path)
        client = self._client_key_fn(request)
        bucket = self._store.get_bucket(client, rule)

        allowed, remaining, wait = bucket.consume()

        if not allowed:
            retry_after = int(wait) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Try again later.",
                    "retry_after": retry_after,
                },
                headers={
                    "X-RateLimit-Limit": str(rule.requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                    "Retry-After": str(retry_after),
                },
            )

        response = await call_next(request)

        # Always attach rate-limit headers so clients know the limits.
        response.headers["X-RateLimit-Limit"] = str(rule.requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(rule.window_seconds)

        return response
