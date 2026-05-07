"""Integration tests for the LineupCast OS API.

Tests end-to-end flows across multiple endpoints.  All tests use the
in-process ASGI transport so no external services are required.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch

from app.config import get_settings
from app.main import app, create_app

DEMO_MATCH_ID = "demo-manchester-red-vs-shanghai-harbor"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    """Ensure settings cache is clean before and after each test."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# 1. Health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body

    @pytest.mark.asyncio
    async def test_healthz_returns_ok(self, client):
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"

    @pytest.mark.asyncio
    async def test_health_includes_version(self, client):
        resp = await client.get("/healthz")
        body = resp.json()
        assert body["version"] is not None
        assert len(body["version"]) > 0


# ---------------------------------------------------------------------------
# 2. Readiness endpoint
# ---------------------------------------------------------------------------


class TestReadinessEndpoint:
    @pytest.mark.asyncio
    async def test_readyz_returns_valid_status(self, client):
        resp = await client.get("/readyz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] in ("ready", "degraded")

    @pytest.mark.asyncio
    async def test_readyz_has_model_info(self, client):
        resp = await client.get("/readyz")
        body = resp.json()
        assert body["model"]["available"] is True

    @pytest.mark.asyncio
    async def test_readyz_has_provider_info(self, client):
        resp = await client.get("/readyz")
        body = resp.json()
        assert body["provider"]["mode"] in ("mock", "model", "external")

    @pytest.mark.asyncio
    async def test_readyz_has_providers_list(self, client):
        resp = await client.get("/readyz")
        body = resp.json()
        assert "providers" in body
        assert isinstance(body["providers"], list)

    @pytest.mark.asyncio
    async def test_readyz_has_provider_freshness(self, client):
        resp = await client.get("/readyz")
        body = resp.json()
        assert "providerFreshness" in body
        assert isinstance(body["providerFreshness"], dict)


# ---------------------------------------------------------------------------
# 3. Demo match
# ---------------------------------------------------------------------------


class TestDemoMatch:
    @pytest.mark.asyncio
    async def test_demo_match_returns_correct_data(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["matchId"] == DEMO_MATCH_ID
        assert body["competition"] == "Super Club Friendly"

    @pytest.mark.asyncio
    async def test_demo_match_has_teams(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}")
        body = resp.json()
        assert body["homeTeam"]["name"] == "Manchester Red"
        assert body["awayTeam"]["name"] == "Shanghai Harbor"

    @pytest.mark.asyncio
    async def test_demo_match_appears_in_list(self, client):
        resp = await client.get("/api/matches")
        assert resp.status_code == 200
        matches = resp.json()
        ids = [m["matchId"] for m in matches]
        assert DEMO_MATCH_ID in ids

    @pytest.mark.asyncio
    async def test_match_not_found_returns_404(self, client):
        resp = await client.get("/api/matches/nonexistent-match-id")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 4. Prediction generation
# ---------------------------------------------------------------------------


class TestPredictionGeneration:
    @pytest.mark.asyncio
    async def test_get_prediction_returns_valid_probabilities(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction")
        assert resp.status_code == 200
        body = resp.json()
        assert body["homeWin"] + body["draw"] + body["awayWin"] == 100

    @pytest.mark.asyncio
    async def test_prediction_has_required_ai_fields(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction")
        body = resp.json()
        assert body["modelName"]
        assert body["modelVersion"]
        assert 0 <= body["confidence"] <= 1
        assert body["explanation"]
        assert body["goalScorers"]
        assert body["cardRisks"]
        assert body["generatedAt"]

    @pytest.mark.asyncio
    async def test_prediction_post_endpoint(self, client):
        resp = await client.post(f"/api/matches/{DEMO_MATCH_ID}/predict")
        assert resp.status_code == 200
        body = resp.json()
        assert body["matchId"] == DEMO_MATCH_ID

    @pytest.mark.asyncio
    async def test_prediction_not_found_for_unknown_match(self, client):
        resp = await client.get("/api/matches/nonexistent/prediction")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_prediction_explain_has_factors(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction/explain")
        assert resp.status_code == 200
        body = resp.json()
        assert body["factors"]
        assert len(body["factors"]) > 0

    @pytest.mark.asyncio
    async def test_prediction_backtest_returns_sample_size(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction/backtest")
        assert resp.status_code == 200
        body = resp.json()
        assert body["sampleSize"] > 0

    @pytest.mark.asyncio
    async def test_card_risks_have_valid_red_risk_levels(self, client):
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction")
        body = resp.json()
        valid_levels = {"low", "medium", "high"}
        for risk in body["cardRisks"]:
            assert risk["redCardRisk"] in valid_levels


# ---------------------------------------------------------------------------
# 5. Script generation
# ---------------------------------------------------------------------------


class TestScriptGeneration:
    @pytest.mark.asyncio
    async def test_generate_script_returns_content(self, client):
        resp = await client.post(
            f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
            json={"language": "en"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["script"]
        assert body["matchId"] == DEMO_MATCH_ID

    @pytest.mark.asyncio
    async def test_script_has_metadata(self, client):
        resp = await client.post(
            f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
            json={"language": "en"},
        )
        body = resp.json()
        assert body["provider"]
        assert body["model"]
        assert body["latencyMs"] >= 0
        assert "fallback" in body

    @pytest.mark.asyncio
    async def test_script_bilingual(self, client):
        resp = await client.post(
            f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
            json={"language": "bilingual"},
        )
        body = resp.json()
        assert body["language"] == "bilingual"

    @pytest.mark.asyncio
    async def test_script_list_after_generation(self, client):
        # Generate a script first
        gen = await client.post(
            f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
            json={"language": "en"},
        )
        script_id = gen.json()["scriptId"]

        # List should include it
        resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/scripts")
        assert resp.status_code == 200
        ids = [s["scriptId"] for s in resp.json()]
        assert script_id in ids

    @pytest.mark.asyncio
    async def test_script_translate(self, client):
        gen = await client.post(
            f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
            json={"language": "en"},
        )
        script_id = gen.json()["scriptId"]

        resp = await client.post(
            f"/api/scripts/{script_id}/translate",
            json={"language": "zh"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["language"] == "zh"


# ---------------------------------------------------------------------------
# 6. CSV import (dry run)
# ---------------------------------------------------------------------------


class TestCsvImport:
    @pytest.mark.asyncio
    async def test_import_match_creates_new_match(self, client):
        resp = await client.post(
            "/api/matches/import",
            json={
                "matchId": "integration-test-import",
                "competition": "Integration Cup",
                "kickoff": "2026-06-01T18:00:00Z",
                "homeTeamId": "manchester-red",
                "awayTeamId": "shanghai-harbor",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["matchId"] == "integration-test-import"
        assert body["competition"] == "Integration Cup"

    @pytest.mark.asyncio
    async def test_imported_match_is_retrievable(self, client):
        # Import
        await client.post(
            "/api/matches/import",
            json={
                "matchId": "integration-retrievable",
                "competition": "Retrievable Cup",
                "kickoff": "2026-06-02T18:00:00Z",
                "homeTeamId": "manchester-red",
                "awayTeamId": "shanghai-harbor",
            },
        )
        # Retrieve
        resp = await client.get("/api/matches/integration-retrievable")
        assert resp.status_code == 200
        assert resp.json()["competition"] == "Retrievable Cup"

    @pytest.mark.asyncio
    async def test_import_nonexistent_team_returns_404(self, client):
        resp = await client.post(
            "/api/matches/import",
            json={
                "matchId": "bad-team-import",
                "competition": "Fail Cup",
                "kickoff": "2026-06-03T18:00:00Z",
                "homeTeamId": "nonexistent-team",
                "awayTeamId": "shanghai-harbor",
            },
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 7. API configuration CRUD
# ---------------------------------------------------------------------------


class TestApiConfigurationCRUD:
    @pytest.mark.asyncio
    async def test_create_and_list_configuration(self, client):
        resp = await client.post(
            "/api/settings/providers",
            json={
                "providerType": "football-data",
                "displayName": "Integration Test Provider",
                "baseUrl": "https://api.example.com",
                "apiKey": "sk-integration-test-key-123",
            },
        )
        assert resp.status_code == 201
        created = resp.json()
        assert created["providerType"] == "football-data"
        assert created["displayName"] == "Integration Test Provider"

        # List
        resp = await client.get("/api/settings/providers")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1

    @pytest.mark.asyncio
    async def test_get_configuration_masks_key(self, client):
        raw_key = "sk-very-secret-integration-key"
        resp = await client.post(
            "/api/settings/providers",
            json={
                "providerType": "football-data",
                "displayName": "Mask Test",
                "apiKey": raw_key,
            },
        )
        config_id = resp.json()["id"]

        resp = await client.get(f"/api/settings/providers/{config_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert raw_key not in body["maskedApiKey"]
        assert "****" in body["maskedApiKey"]

    @pytest.mark.asyncio
    async def test_update_configuration(self, client):
        resp = await client.post(
            "/api/settings/providers",
            json={
                "providerType": "football-data",
                "displayName": "Before Update",
                "apiKey": "sk-update-test",
            },
        )
        config_id = resp.json()["id"]

        resp = await client.patch(
            f"/api/settings/providers/{config_id}",
            json={"displayName": "After Update"},
        )
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "After Update"

    @pytest.mark.asyncio
    async def test_delete_configuration(self, client):
        resp = await client.post(
            "/api/settings/providers",
            json={
                "providerType": "football-data",
                "displayName": "Delete Me",
                "apiKey": "sk-delete-test",
            },
        )
        config_id = resp.json()["id"]

        resp = await client.delete(f"/api/settings/providers/{config_id}")
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(f"/api/settings/providers/{config_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 8. Data completeness
# ---------------------------------------------------------------------------


class TestDataCompleteness:
    @pytest.mark.asyncio
    async def test_data_completeness_for_demo_match(self, client):
        resp = await client.get(
            f"/api/matches/{DEMO_MATCH_ID}/data-completeness"
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "score" in body
        assert 0 <= body["score"] <= 100
        assert "availableCategories" in body
        assert "missingCategories" in body

    @pytest.mark.asyncio
    async def test_data_completeness_has_flags(self, client):
        resp = await client.get(
            f"/api/matches/{DEMO_MATCH_ID}/data-completeness"
        )
        body = resp.json()
        assert "flags" in body
        assert isinstance(body["flags"], dict)

    @pytest.mark.asyncio
    async def test_data_completeness_nonexistent_match(self, client):
        resp = await client.get(
            "/api/matches/nonexistent/data-completeness"
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 9. Provider list
# ---------------------------------------------------------------------------


class TestProviderList:
    @pytest.mark.asyncio
    async def test_providers_returns_list(self, client):
        resp = await client.get("/api/providers")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) > 0

    @pytest.mark.asyncio
    async def test_providers_include_mock(self, client):
        resp = await client.get("/api/providers")
        body = resp.json()
        ids = [p["id"] for p in body]
        assert "mock-provider" in ids

    @pytest.mark.asyncio
    async def test_provider_test_endpoint(self, client):
        resp = await client.post(
            "/api/providers/test",
            json={"providerId": "mock-provider"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True

    @pytest.mark.asyncio
    async def test_provider_sync_endpoint(self, client):
        resp = await client.post("/api/providers/sync")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "synced"

    @pytest.mark.asyncio
    async def test_provider_logs(self, client):
        resp = await client.get("/api/providers/logs")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) > 0


# ---------------------------------------------------------------------------
# Cross-cutting integration: match -> prediction -> script flow
# ---------------------------------------------------------------------------


class TestFullWorkflow:
    """Test the complete match-to-script pipeline."""

    @pytest.mark.asyncio
    async def test_full_pipeline(self, client):
        """Import match -> predict -> generate script -> list scripts."""
        # 1. Import a match
        import_resp = await client.post(
            "/api/matches/import",
            json={
                "matchId": "pipeline-test",
                "competition": "Pipeline Cup",
                "kickoff": "2026-07-01T20:00:00Z",
                "homeTeamId": "manchester-red",
                "awayTeamId": "shanghai-harbor",
            },
        )
        assert import_resp.status_code == 201

        # 2. Get prediction
        pred_resp = await client.get("/api/matches/pipeline-test/prediction")
        assert pred_resp.status_code == 200
        pred = pred_resp.json()
        assert pred["homeWin"] + pred["draw"] + pred["awayWin"] == 100

        # 3. Generate script
        script_resp = await client.post(
            "/api/matches/pipeline-test/scripts/generate",
            json={"language": "en"},
        )
        assert script_resp.status_code == 200
        script = script_resp.json()
        assert script["script"]

        # 4. List scripts
        list_resp = await client.get("/api/matches/pipeline-test/scripts")
        assert list_resp.status_code == 200
        scripts = list_resp.json()
        assert any(s["scriptId"] == script["scriptId"] for s in scripts)

    @pytest.mark.asyncio
    async def test_models_endpoint(self, client):
        resp = await client.get("/api/models")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) > 0
        # Get detail for first model
        model_id = body[0]["modelId"]
        detail = await client.get(f"/api/models/{model_id}")
        assert detail.status_code == 200

    @pytest.mark.asyncio
    async def test_leagues_endpoint(self, client):
        resp = await client.get("/api/leagues")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
