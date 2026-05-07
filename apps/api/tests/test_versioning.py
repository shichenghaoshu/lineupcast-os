"""Tests for API versioning: /api/v1 prefix, /api backward compat, X-API-Version header."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app, API_VERSION


DEMO_MATCH_ID = "demo-manchester-red-vs-shanghai-harbor"


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# X-API-Version header
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_version_header_present_on_health(client):
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.headers["X-API-Version"] == API_VERSION


@pytest.mark.asyncio
async def test_version_header_present_on_api_v1(client):
    resp = await client.get("/api/v1/matches")
    assert resp.status_code == 200
    assert resp.headers["X-API-Version"] == API_VERSION


@pytest.mark.asyncio
async def test_version_header_present_on_backward_compat(client):
    resp = await client.get("/api/matches")
    assert resp.status_code == 200
    assert resp.headers["X-API-Version"] == API_VERSION


@pytest.mark.asyncio
async def test_version_header_present_on_404(client):
    resp = await client.get("/api/v1/matches/nonexistent-match-id")
    assert resp.status_code == 404
    assert resp.headers["X-API-Version"] == API_VERSION


# ---------------------------------------------------------------------------
# Version info endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_version_endpoint_api(client):
    resp = await client.get("/api/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apiVersion"] == API_VERSION
    assert data["appVersion"]
    assert data["appName"]


@pytest.mark.asyncio
async def test_version_endpoint_v1(client):
    resp = await client.get("/api/v1/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apiVersion"] == API_VERSION
    assert data["appVersion"]
    assert data["appName"]


@pytest.mark.asyncio
async def test_version_header_on_version_endpoint(client):
    resp = await client.get("/api/version")
    assert resp.headers["X-API-Version"] == API_VERSION


# ---------------------------------------------------------------------------
# /api/v1 prefix (canonical)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_v1_matches_list(client):
    resp = await client.get("/api/v1/matches")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["matchId"] == DEMO_MATCH_ID


@pytest.mark.asyncio
async def test_v1_match_detail(client):
    resp = await client.get(f"/api/v1/matches/{DEMO_MATCH_ID}")
    assert resp.status_code == 200
    assert resp.json()["matchId"] == DEMO_MATCH_ID


@pytest.mark.asyncio
async def test_v1_teams(client):
    resp = await client.get("/api/v1/teams/manchester-red")
    assert resp.status_code == 200
    assert resp.json()["teamId"] == "manchester-red"


@pytest.mark.asyncio
async def test_v1_players(client):
    resp = await client.get(f"/api/v1/matches/{DEMO_MATCH_ID}/players")
    assert resp.status_code == 200
    assert len(resp.json()) == 22


@pytest.mark.asyncio
async def test_v1_lineups(client):
    resp = await client.get(f"/api/v1/matches/{DEMO_MATCH_ID}/lineups")
    assert resp.status_code == 200
    assert resp.json()["matchId"] == DEMO_MATCH_ID


@pytest.mark.asyncio
async def test_v1_prediction(client):
    resp = await client.post(f"/api/v1/matches/{DEMO_MATCH_ID}/predict")
    assert resp.status_code == 200
    data = resp.json()
    assert data["modelName"]
    assert 0 <= data["confidence"] <= 1


@pytest.mark.asyncio
async def test_v1_models(client):
    resp = await client.get("/api/v1/models")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_v1_providers(client):
    resp = await client.get("/api/v1/providers")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_v1_leagues(client):
    resp = await client.get("/api/v1/leagues")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_v1_snapshots(client):
    resp = await client.get("/api/v1/snapshots")
    assert resp.status_code == 200
    assert "snapshots" in resp.json()


# ---------------------------------------------------------------------------
# /api backward-compatible alias
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_compat_matches_list(client):
    resp = await client.get("/api/matches")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["matchId"] == DEMO_MATCH_ID


@pytest.mark.asyncio
async def test_compat_match_detail(client):
    resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}")
    assert resp.status_code == 200
    assert resp.json()["matchId"] == DEMO_MATCH_ID


@pytest.mark.asyncio
async def test_compat_prediction(client):
    resp = await client.post(f"/api/matches/{DEMO_MATCH_ID}/predict")
    assert resp.status_code == 200
    data = resp.json()
    assert data["modelName"]


@pytest.mark.asyncio
async def test_compat_models(client):
    resp = await client.get("/api/models")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_compat_providers(client):
    resp = await client.get("/api/providers")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Equivalence: v1 and compat return the same data
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_v1_and_compat_return_same_matches(client):
    v1 = await client.get("/api/v1/matches")
    compat = await client.get("/api/matches")
    assert v1.status_code == compat.status_code == 200
    assert v1.json() == compat.json()


@pytest.mark.asyncio
async def test_v1_and_compat_return_same_match_detail(client):
    v1 = await client.get(f"/api/v1/matches/{DEMO_MATCH_ID}")
    compat = await client.get(f"/api/matches/{DEMO_MATCH_ID}")
    assert v1.status_code == compat.status_code == 200
    assert v1.json() == compat.json()


@pytest.mark.asyncio
async def test_v1_and_compat_return_same_models(client):
    v1 = await client.get("/api/v1/models")
    compat = await client.get("/api/models")
    assert v1.status_code == compat.status_code == 200
    assert v1.json() == compat.json()


@pytest.mark.asyncio
async def test_v1_and_compat_return_same_providers(client):
    v1 = await client.get("/api/v1/providers")
    compat = await client.get("/api/providers")
    assert v1.status_code == compat.status_code == 200
    assert v1.json() == compat.json()


# ---------------------------------------------------------------------------
# Import routes versioned
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_v1_import_templates(client):
    resp = await client.get("/api/v1/import/templates")
    assert resp.status_code == 200
    assert "templates" in resp.json()


@pytest.mark.asyncio
async def test_compat_import_templates(client):
    resp = await client.get("/api/import/templates")
    assert resp.status_code == 200
    assert "templates" in resp.json()


# ---------------------------------------------------------------------------
# POST routes under versioned prefix
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_v1_match_import(client):
    resp = await client.post(
        "/api/v1/matches/import",
        json={
            "matchId": "v1-test-match",
            "competition": "V1 Cup",
            "kickoff": "2026-05-07T20:00:00Z",
            "homeTeamId": "manchester-red",
            "awayTeamId": "shanghai-harbor",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["matchId"] == "v1-test-match"


@pytest.mark.asyncio
async def test_v1_script_generate(client):
    resp = await client.post(
        f"/api/v1/matches/{DEMO_MATCH_ID}/scripts/generate",
        json={"language": "en"},
    )
    assert resp.status_code == 200
    assert resp.json()["language"] == "en"


# ---------------------------------------------------------------------------
# Health endpoints are NOT under /api/v1
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_healthz_at_root(client):
    resp = await client.get("/healthz")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_readyz_at_root(client):
    resp = await client.get("/readyz")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_at_root(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
