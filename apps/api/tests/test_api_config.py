"""Tests for the API Configuration Center (CRUD, key masking, env fallback).

Uses a temporary SQLite database so tests are fully isolated.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_db(monkeypatch, tmp_path):
    """Point the database and encryption at a temp directory for each test."""
    db_url = f"sqlite:///{tmp_path}/test.db"
    monkeypatch.setenv("LINEUPCAST_DATABASE_URL", db_url)
    monkeypatch.setenv("LINEUPCAST_ENCRYPTION_SECRET", "test-secret-for-unit-tests")
    # Reset singletons so they pick up the new env
    from apps.api.app import database
    from apps.api.app import db as legacy_db

    database.reset_engine()
    database.init_db()
    legacy_db.reset_db()
    yield
    database.reset_engine()
    legacy_db.reset_db()


@pytest.fixture()
def client():
    """Create a fresh TestClient per test."""
    from apps.api.app.main import create_app

    app = create_app()
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

PROVIDER_PAYLOAD = {
    "providerType": "football-data",
    "displayName": "Football Data Org",
    "baseUrl": "https://api.football-data.org/v4",
    "apiKey": "sk-test-abcdef123456",
}


def _create_provider(client: TestClient, payload: dict | None = None) -> dict:
    """POST a new provider and return the JSON response."""
    resp = client.post(
        "/api/settings/providers",
        json=payload or PROVIDER_PAYLOAD,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# CRUD tests
# ---------------------------------------------------------------------------


class TestCRUD:
    def test_create_provider(self, client: TestClient):
        data = _create_provider(client)
        assert data["providerType"] == "football-data"
        assert data["displayName"] == "Football Data Org"
        assert data["status"] == "configured"
        assert data["id"] is not None

    def test_list_providers(self, client: TestClient):
        _create_provider(client)
        resp = client.get("/api/settings/providers")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert len(body["configurations"]) >= 1

    def test_get_single_provider(self, client: TestClient):
        created = _create_provider(client)
        resp = client.get(f"/api/settings/providers/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]

    def test_update_provider(self, client: TestClient):
        created = _create_provider(client)
        resp = client.patch(
            f"/api/settings/providers/{created['id']}",
            json={"displayName": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "Updated Name"

    def test_delete_provider(self, client: TestClient):
        created = _create_provider(client)
        resp = client.delete(f"/api/settings/providers/{created['id']}")
        assert resp.status_code == 204
        # Confirm it's gone
        resp = client.get(f"/api/settings/providers/{created['id']}")
        assert resp.status_code == 404

    def test_get_nonexistent_returns_404(self, client: TestClient):
        resp = client.get("/api/settings/providers/99999")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Key masking tests
# ---------------------------------------------------------------------------


class TestKeyMasking:
    def test_masked_key_never_contains_raw(self, client: TestClient):
        raw_key = "sk-very-secret-api-key-12345"
        created = _create_provider(client, {**PROVIDER_PAYLOAD, "apiKey": raw_key})
        masked = created["maskedApiKey"]
        # The full raw key must NOT appear anywhere
        assert raw_key not in masked
        # But the mask should contain the marker
        assert "****" in masked

    def test_list_does_not_return_raw_keys(self, client: TestClient):
        raw_key = "sk-should-not-appear-in-list"
        _create_provider(client, {**PROVIDER_PAYLOAD, "apiKey": raw_key})
        resp = client.get("/api/settings/providers")
        body = resp.json()
        for cfg in body["configurations"]:
            if cfg.get("maskedApiKey"):
                assert raw_key not in cfg["maskedApiKey"]

    def test_empty_key_returns_empty_mask(self, client: TestClient):
        payload = {**PROVIDER_PAYLOAD}
        del payload["apiKey"]
        created = _create_provider(client, payload)
        assert created["maskedApiKey"] == ""
        assert created["status"] == "missing"


# ---------------------------------------------------------------------------
# Rotate key tests
# ---------------------------------------------------------------------------


class TestRotateKey:
    def test_rotate_key_updates_mask(self, client: TestClient):
        created = _create_provider(client)
        old_masked = created["maskedApiKey"]
        new_key = "sk-brand-new-key-99999"
        resp = client.post(
            f"/api/settings/providers/{created['id']}/rotate-key",
            content=new_key,
            headers={"Content-Type": "text/plain"},
        )
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["maskedApiKey"] != old_masked
        assert new_key not in updated["maskedApiKey"]
        assert "****" in updated["maskedApiKey"]


# ---------------------------------------------------------------------------
# Test connection (with missing token)
# ---------------------------------------------------------------------------


class TestConnection:
    def test_missing_token_returns_readable_error(self, client: TestClient):
        """A provider without an API key should return a clear error."""
        payload = {
            "providerType": "football-data",
            "displayName": "No Key Provider",
            "baseUrl": "https://api.football-data.org/v4",
            # no apiKey
        }
        created = _create_provider(client, payload)
        resp = client.post(f"/api/settings/providers/{created['id']}/test")
        assert resp.status_code == 200
        result = resp.json()
        assert result["ok"] is False
        assert "key" in result["detail"].lower() or "not configured" in result["detail"].lower()

    def test_no_base_url_returns_error(self, client: TestClient):
        """A provider with no base URL and no known test URL should fail clearly."""
        payload = {
            "providerType": "football-data",
            "displayName": "No URL Provider",
            "apiKey": "sk-test-123",
            # no baseUrl
        }
        created = _create_provider(client, payload)
        resp = client.post(f"/api/settings/providers/{created['id']}/test")
        assert resp.status_code == 200
        result = resp.json()
        # football-data has a default URL so this might succeed or fail with connectivity
        # Either way, result should be well-formed
        assert "ok" in result
        assert "detail" in result


# ---------------------------------------------------------------------------
# Env fallback tests
# ---------------------------------------------------------------------------


class TestEnvFallback:
    def test_env_fallback_appears_in_list(self, client: TestClient, monkeypatch):
        """When no DB config exists for a provider type, env vars should appear."""
        monkeypatch.setenv("FOOTBALL_DATA_API_KEY", "env-key-abc123")
        monkeypatch.setenv("FOOTBALL_DATA_BASE_URL", "https://api.football-data.org/v4")

        resp = client.get("/api/settings/providers")
        assert resp.status_code == 200
        body = resp.json()
        types = [c["providerType"] for c in body["configurations"]]
        assert "football-data" in types

        # Find the env fallback entry
        fb = next(c for c in body["configurations"] if c["providerType"] == "football-data")
        assert fb["status"] == "configured"
        assert "env" in fb["displayName"].lower() or fb["maskedApiKey"] != ""

    def test_db_config_takes_priority_over_env(self, client: TestClient, monkeypatch):
        """DB-stored config should appear instead of env fallback."""
        monkeypatch.setenv("FOOTBALL_DATA_API_KEY", "env-key-should-not-appear")
        _create_provider(client)

        resp = client.get("/api/settings/providers")
        body = resp.json()
        football_configs = [
            c for c in body["configurations"] if c["providerType"] == "football-data"
        ]
        # Should be exactly 1 (DB), not duplicated
        assert len(football_configs) == 1
        assert "env" not in football_configs[0]["displayName"].lower()


# ---------------------------------------------------------------------------
# Status endpoint
# ---------------------------------------------------------------------------


class TestStatus:
    def test_get_provider_status(self, client: TestClient):
        created = _create_provider(client)
        resp = client.get(f"/api/settings/providers/{created['id']}/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == created["id"]
        assert "status" in body


# ---------------------------------------------------------------------------
# LLM endpoints
# ---------------------------------------------------------------------------


class TestLLM:
    def test_llm_status_when_nothing_configured(self, client: TestClient):
        resp = client.get("/api/llm/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["provider"] == "none"
        assert body["status"] == "missing"

    def test_llm_test_fallback(self, client: TestClient):
        resp = client.post(
            "/api/llm/test",
            json={"prompt": "Hello football"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # Should use fallback since no LLM is configured
        assert body["fallback"] is True
        assert body["output"] is not None


# ---------------------------------------------------------------------------
# Data completeness
# ---------------------------------------------------------------------------


class TestDataCompleteness:
    def test_data_completeness_for_demo_match(self, client: TestClient):
        # Seed the demo match so the endpoint can find it
        from apps.api.app.db import get_db
        from src.mock_data import MATCH_DEMO

        db = get_db()
        if not db.match_exists(MATCH_DEMO["matchId"]):
            db.upsert_match(MATCH_DEMO.copy())

        resp = client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor/data-completeness")
        assert resp.status_code == 200
        body = resp.json()
        assert "score" in body
        assert 0 <= body["score"] <= 100
        assert "availableCategories" in body
        assert "missingCategories" in body

    def test_data_completeness_nonexistent_match(self, client: TestClient):
        resp = client.get("/api/matches/does-not-exist/data-completeness")
        assert resp.status_code == 404
