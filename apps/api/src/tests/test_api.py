"""Tests for the LineupCast API endpoints."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.index import app

DEMO_MATCH_ID = "demo-manchester-red-vs-shanghai-harbor"


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_demo_match(client):
    resp = await client.get("/api/matches/demo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["matchId"] == DEMO_MATCH_ID
    assert data["competition"] == "Super Club Friendly"
    assert data["homeTeam"]["name"] == "Manchester Red"
    assert data["awayTeam"]["name"] == "Shanghai Harbor"


@pytest.mark.asyncio
async def test_team_found(client):
    resp = await client.get("/api/teams/manchester-red")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Manchester Red"
    assert data["founded"] == 1878


@pytest.mark.asyncio
async def test_team_not_found(client):
    resp = await client.get("/api/teams/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_player_found(client):
    resp = await client.get("/api/players/manchester-red-v-finish")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "V. Finish"
    assert data["position"] == "ST"
    assert data["number"] == 9
    assert "coordinates" in data
    assert data["coordinates"]["x"] == 85


@pytest.mark.asyncio
async def test_player_not_found(client):
    resp = await client.get("/api/players/nonexistent-player")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_match_lineups(client):
    resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/lineups")
    assert resp.status_code == 200
    data = resp.json()
    assert data["home"]["formation"] == "4-2-3-1"
    assert data["away"]["formation"] == "4-3-3"
    assert len(data["home"]["players"]) == 11
    assert len(data["away"]["players"]) == 11
    names = [p["name"] for p in data["home"]["players"]]
    assert names == [
        "A. Keeper",
        "L. Wing",
        "N. Cross",
        "M. Stone",
        "R. Block",
        "D. Tempo",
        "C. Press",
        "J. Spark",
        "B. Vision",
        "K. Burst",
        "V. Finish",
    ]
    assert sorted(p["number"] for p in data["home"]["players"]) == list(range(1, 12))
    assert [p["position"] for p in data["home"]["players"]] == [
        "GK",
        "RB",
        "LB",
        "CB",
        "CB",
        "DM",
        "DM",
        "RW",
        "AM",
        "LW",
        "ST",
    ]


@pytest.mark.asyncio
async def test_match_lineups_not_found(client):
    resp = await client.get("/api/matches/nonexistent/lineups")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_prediction(client):
    resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction")
    assert resp.status_code == 200
    data = resp.json()
    assert data["homeWin"] + data["draw"] + data["awayWin"] == 100
    assert 0 <= data["homeWin"] <= 100
    assert 0 <= data["draw"] <= 100
    assert 0 <= data["awayWin"] <= 100
    assert data["expectedHomeGoals"] > 0
    assert data["expectedAwayGoals"] > 0
    assert 0 <= data["confidence"] <= 1
    assert len(data["goalScorers"]) == 4
    assert len(data["cardRisks"]) == 4
    assert len(data["models"]) >= 3
    assert {model["reference"] for model in data["models"]} >= {
        "docs/model-cards/dixon-coles.md",
        "docs/model-cards/player-rating-adjustment.md",
        "docs/model-cards/xg-share.md",
    }


@pytest.mark.asyncio
async def test_prediction_not_found(client):
    resp = await client.get("/api/matches/nonexistent/prediction")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_script(client):
    prediction = await client.get(f"/api/matches/{DEMO_MATCH_ID}/prediction")
    assert prediction.status_code == 200
    prediction_data = prediction.json()
    home_win = prediction_data["homeWin"]
    expected_home_goals = f"{prediction_data['expectedHomeGoals']:.1f}"

    resp = await client.post(f"/api/matches/{DEMO_MATCH_ID}/script")
    assert resp.status_code == 200
    data = resp.json()
    assert "script" in data
    assert "disclaimer" in data
    assert "V. Finish" in data["script"]
    assert f"{home_win}%" in data["script"]
    assert expected_home_goals in data["script"]
    assert "DISCLAIMER" in data["disclaimer"]
    assert "mock demonstration data" in data["disclaimer"]


@pytest.mark.asyncio
async def test_script_not_found(client):
    resp = await client.post("/api/matches/nonexistent/script")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_overlay(client):
    resp = await client.get(f"/api/matches/{DEMO_MATCH_ID}/overlay")
    assert resp.status_code == 200
    data = resp.json()
    zones = data["zones"]
    assert "landscape_16x9" in zones
    assert "portrait_9x16" in zones
    assert "lower_third" in zones
    assert "prediction_strip" in zones
    assert zones["landscape_16x9"]["width"] == 1920
    assert zones["landscape_16x9"]["height"] == 1080
    assert zones["portrait_9x16"]["width"] == 1080
    assert zones["portrait_9x16"]["height"] == 1920


@pytest.mark.asyncio
async def test_overlay_not_found(client):
    resp = await client.get("/api/matches/nonexistent/overlay")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_providers(client):
    resp = await client.get("/api/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 6
    ids = [p["id"] for p in data]
    assert "mock-provider" in ids
    assert "openfootball" in ids
    assert "statsbomb-open-data" in ids
    assert "football-data-org" in ids
    assert "sportmonks" in ids
    assert "api-football" in ids
