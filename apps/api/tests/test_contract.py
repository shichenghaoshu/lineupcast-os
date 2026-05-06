"""Contract tests for the deployable FastAPI API."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


DEMO_MATCH_ID = "demo-manchester-red-vs-shanghai-harbor"


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_healthz_and_readyz(client):
    health = await client.get("/healthz")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    ready = await client.get("/readyz")
    assert ready.status_code == 200
    data = ready.json()
    assert data["status"] in {"ready", "degraded"}
    assert data["model"]["available"] is True
    assert data["provider"]["mode"] in {"mock", "external"}


@pytest.mark.asyncio
async def test_matches_import_and_lookup(client):
    listed = await client.get("/api/matches")
    assert listed.status_code == 200
    assert listed.json()[0]["matchId"] == DEMO_MATCH_ID

    imported = await client.post(
        "/api/matches/import",
        json={
            "matchId": "friendly-test",
            "competition": "Contract Cup",
            "kickoff": "2026-05-06T20:00:00Z",
            "homeTeamId": "manchester-red",
            "awayTeamId": "shanghai-harbor",
        },
    )
    assert imported.status_code == 201
    assert imported.json()["matchId"] == "friendly-test"

    fetched = await client.get("/api/matches/friendly-test")
    assert fetched.status_code == 200
    assert fetched.json()["competition"] == "Contract Cup"


@pytest.mark.asyncio
async def test_prediction_contract_contains_required_ai_fields(client):
    created = await client.post(f"/api/matches/{DEMO_MATCH_ID}/predict")
    assert created.status_code == 200
    data = created.json()
    assert data["modelName"]
    assert data["modelVersion"]
    assert 0 <= data["confidence"] <= 1
    assert data["explanation"]
    assert data["references"]
    assert data["goalScorers"]
    assert data["cardRisks"]
    assert data["generatedAt"]
    assert {risk["redCardRisk"] for risk in data["cardRisks"]} <= {
        "low",
        "medium",
        "high",
    }

    explain = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction/explain")
    assert explain.status_code == 200
    assert explain.json()["factors"]

    backtest = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction/backtest")
    assert backtest.status_code == 200
    assert backtest.json()["sampleSize"] > 0


@pytest.mark.asyncio
async def test_lineups_players_scripts_models_and_providers(client):
    refresh = await client.post(f"/api/matches/{DEMO_MATCH_ID}/lineups/refresh")
    assert refresh.status_code == 200
    assert refresh.json()["status"] == "refreshed"

    players = await client.get(f"/api/matches/{DEMO_MATCH_ID}/players")
    assert players.status_code == 200
    assert len(players.json()) == 22

    script = await client.post(
        f"/api/matches/{DEMO_MATCH_ID}/scripts/generate",
        json={"language": "bilingual"},
    )
    assert script.status_code == 200
    script_data = script.json()
    assert script_data["language"] == "bilingual"
    assert script_data["provider"]
    assert script_data["model"]
    assert script_data["latencyMs"] >= 0
    assert "fallback" in script_data

    scripts = await client.get(f"/api/matches/{DEMO_MATCH_ID}/scripts")
    assert scripts.status_code == 200
    assert scripts.json()[0]["scriptId"] == script_data["scriptId"]

    translated = await client.post(
        f"/api/scripts/{script_data['scriptId']}/translate",
        json={"language": "zh"},
    )
    assert translated.status_code == 200
    assert translated.json()["language"] == "zh"

    models = await client.get("/api/models")
    assert models.status_code == 200
    model_id = models.json()[0]["modelId"]
    for suffix in ("", "/card", "/evaluation"):
        response = await client.get(f"/api/models/{model_id}{suffix}")
        assert response.status_code == 200

    model_backtest = await client.post("/api/models/backtest", json={"modelId": model_id})
    assert model_backtest.status_code == 200
    assert model_backtest.json()["modelId"] == model_id

    provider_test = await client.post(
        "/api/providers/test", json={"providerId": "mock-fixture-feed"}
    )
    assert provider_test.status_code == 200
    assert provider_test.json()["ok"] is True

    provider_sync = await client.post("/api/providers/sync")
    assert provider_sync.status_code == 200
    assert provider_sync.json()["status"] == "synced"

    logs = await client.get("/api/providers/logs")
    assert logs.status_code == 200
    assert logs.json()
