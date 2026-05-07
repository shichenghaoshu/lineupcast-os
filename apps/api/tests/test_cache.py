"""Tests for the caching layer."""

from __future__ import annotations

import time

import pytest
from httpx import ASGITransport, AsyncClient

from app.cache import CacheStore, cached, clear_all, get_cache, invalidate, invalidate_prefix


# ---------------------------------------------------------------------------
# CacheStore unit tests
# ---------------------------------------------------------------------------


class TestCacheStore:
    def setup_method(self):
        self.cache = CacheStore(max_size=10)

    def test_set_and_get(self):
        self.cache.set("k", "v", ttl=10)
        hit, value = self.cache.get("k")
        assert hit is True
        assert value == "v"

    def test_miss_returns_none(self):
        hit, value = self.cache.get("missing")
        assert hit is False
        assert value is None

    def test_expired_entry_evicted(self):
        self.cache.set("k", "v", ttl=0.01)
        time.sleep(0.02)
        hit, value = self.cache.get("k")
        assert hit is False
        assert value is None

    def test_delete(self):
        self.cache.set("k", "v", ttl=10)
        assert self.cache.delete("k") is True
        hit, _ = self.cache.get("k")
        assert hit is False

    def test_delete_nonexistent(self):
        assert self.cache.delete("nope") is False

    def test_delete_prefix(self):
        self.cache.set("matches:list", [1], ttl=10)
        self.cache.set("matches:abc", [2], ttl=10)
        self.cache.set("models:list", [3], ttl=10)
        removed = self.cache.delete_prefix("matches:")
        assert removed == 2
        hit, _ = self.cache.get("models:list")
        assert hit is True

    def test_clear(self):
        self.cache.set("a", 1, ttl=10)
        self.cache.set("b", 2, ttl=10)
        self.cache.clear()
        assert self.cache.size == 0

    def test_prune(self):
        self.cache.set("expired", "old", ttl=0.01)
        self.cache.set("alive", "new", ttl=10)
        time.sleep(0.02)
        pruned = self.cache.prune()
        assert pruned == 1
        hit, _ = self.cache.get("alive")
        assert hit is True

    def test_max_size_eviction(self):
        small = CacheStore(max_size=2)
        small.set("a", 1, ttl=10)
        small.set("b", 2, ttl=10)
        small.set("c", 3, ttl=10)  # should evict "a"
        hit_a, _ = small.get("a")
        assert hit_a is False
        hit_c, _ = small.get("c")
        assert hit_c is True

    def test_remaining_ttl(self):
        self.cache.set("k", "v", ttl=10)
        ttl = self.cache.remaining_ttl("k")
        assert ttl is not None
        assert 9.0 <= ttl <= 10.0

    def test_remaining_ttl_missing(self):
        assert self.cache.remaining_ttl("nope") is None

    def test_stats(self):
        self.cache.set("k", "v", ttl=10)
        self.cache.get("k")  # hit
        self.cache.get("missing")  # miss
        stats = self.cache.stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1
        assert stats["hit_rate"] == 0.5

    def test_overwrite_same_key(self):
        self.cache.set("k", "first", ttl=10)
        self.cache.set("k", "second", ttl=10)
        hit, value = self.cache.get("k")
        assert hit is True
        assert value == "second"
        assert self.cache.size == 1

    def test_thread_safety(self):
        """Basic smoke test: concurrent set/get should not raise."""
        import threading

        errors: list[Exception] = []

        def writer():
            try:
                for i in range(50):
                    self.cache.set(f"t-{i}", i, ttl=10)
            except Exception as e:
                errors.append(e)

        def reader():
            try:
                for i in range(50):
                    self.cache.get(f"t-{i}")
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=writer) for _ in range(4)]
        threads += [threading.Thread(target=reader) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == []


# ---------------------------------------------------------------------------
# @cached decorator tests
# ---------------------------------------------------------------------------


class TestCachedDecorator:
    def setup_method(self):
        # Use a fresh store for each test
        self._original = get_cache()
        import app.cache as cache_mod
        self._fresh = CacheStore()
        cache_mod._store = self._fresh

    def teardown_method(self):
        import app.cache as cache_mod
        cache_mod._store = self._original

    def test_caches_result(self):
        call_count = 0

        @cached("test", ttl=10)
        def expensive(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x * 2

        assert expensive(5) == 10
        assert expensive(5) == 10
        assert call_count == 1  # only called once

    def test_different_args_different_keys(self):
        call_count = 0

        @cached("test", ttl=10)
        def expensive(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x

        expensive(1)
        expensive(2)
        assert call_count == 2

    def test_invalidate_on_decorator(self):
        call_count = 0

        @cached("test", ttl=10)
        def expensive(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x

        expensive(1)
        assert call_count == 1
        expensive.invalidate(1)  # type: ignore[attr-defined]
        expensive(1)
        assert call_count == 2

    def test_invalidate_prefix_on_decorator(self):
        call_count = 0

        @cached("test", ttl=10)
        def expensive(x: int) -> int:
            nonlocal call_count
            call_count += 1
            return x

        expensive(1)
        expensive(2)
        assert call_count == 2
        expensive.invalidate_prefix()  # type: ignore[attr-defined]
        expensive(1)
        assert call_count == 3


# ---------------------------------------------------------------------------
# Module-level helper tests
# ---------------------------------------------------------------------------


class TestModuleHelpers:
    def setup_method(self):
        import app.cache as cache_mod
        self._fresh = CacheStore()
        cache_mod._store = self._fresh

    def test_invalidate_single(self):
        self._fresh.set("k", "v", ttl=10)
        assert invalidate("k") is True
        hit, _ = self._fresh.get("k")
        assert hit is False

    def test_invalidate_prefix(self):
        self._fresh.set("a:1", 1, ttl=10)
        self._fresh.set("a:2", 2, ttl=10)
        self._fresh.set("b:1", 3, ttl=10)
        removed = invalidate_prefix("a:")
        assert removed == 2
        hit, _ = self._fresh.get("b:1")
        assert hit is True

    def test_clear_all(self):
        self._fresh.set("a", 1, ttl=10)
        self._fresh.set("b", 2, ttl=10)
        clear_all()
        assert self._fresh.size == 0


# ---------------------------------------------------------------------------
# Integration tests: HTTP cache headers
# ---------------------------------------------------------------------------


@pytest.fixture
def app():
    from app.main import create_app

    return create_app()


@pytest.fixture
async def client(app):
    # Clear the global cache before each test to ensure isolation
    clear_all()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
class TestCacheHeaders:
    async def test_matches_miss_then_hit(self, client: AsyncClient):
        # First request: MISS
        r1 = await client.get("/api/matches")
        assert r1.status_code == 200
        assert r1.headers.get("X-Cache") == "MISS"
        assert "X-Cache-TTL" in r1.headers

        # Second request: HIT
        r2 = await client.get("/api/matches")
        assert r2.status_code == 200
        assert r2.headers.get("X-Cache") == "HIT"
        assert "X-Cache-TTL" in r2.headers

    async def test_match_by_id_miss_then_hit(self, client: AsyncClient):
        r1 = await client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor")
        assert r1.status_code == 200
        assert r1.headers.get("X-Cache") == "MISS"

        r2 = await client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor")
        assert r2.status_code == 200
        assert r2.headers.get("X-Cache") == "HIT"

    async def test_models_list_miss_then_hit(self, client: AsyncClient):
        r1 = await client.get("/api/models")
        assert r1.status_code == 200
        assert r1.headers.get("X-Cache") == "MISS"

        r2 = await client.get("/api/models")
        assert r2.status_code == 200
        assert r2.headers.get("X-Cache") == "HIT"

    async def test_leagues_miss_then_hit(self, client: AsyncClient):
        r1 = await client.get("/api/leagues")
        assert r1.status_code == 200
        assert r1.headers.get("X-Cache") == "MISS"

        r2 = await client.get("/api/leagues")
        assert r2.status_code == 200
        assert r2.headers.get("X-Cache") == "HIT"

    async def test_cache_key_header_present(self, client: AsyncClient):
        r = await client.get("/api/matches")
        assert "X-Cache-Key" in r.headers
        assert r.headers["X-Cache-Key"] == "matches:list"

    async def test_no_cache_header_on_uncached_endpoint(self, client: AsyncClient):
        r = await client.get("/healthz")
        assert r.status_code == 200
        assert "X-Cache" not in r.headers


@pytest.mark.anyio
class TestCacheInvalidation:
    async def test_import_match_busts_list_cache(self, client: AsyncClient):
        # Prime the cache
        await client.get("/api/matches")
        r = await client.get("/api/matches")
        assert r.headers.get("X-Cache") == "HIT"

        # Import a match (write operation)
        await client.post(
            "/api/matches/import",
            json={
                "homeTeamId": "manchester-red",
                "awayTeamId": "shanghai-harbor",
                "competition": "Friendly",
                "kickoff": "2026-06-01T15:00:00Z",
            },
            headers={"Authorization": "Bearer test-token"},
        )

        # Cache should be invalidated
        r2 = await client.get("/api/matches")
        assert r2.headers.get("X-Cache") == "MISS"
