"""Tests for the Prediction Registry with input snapshots and audit trail.

Tests the prediction_registry module which provides:
- Immutable input snapshot storage for every prediction
- Full audit trail (model version, data version, provider IDs, etc.)
- Prediction record retrieval with all metadata

Uses a temporary SQLite database so tests are fully isolated.
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import patch

from app.db import Database, get_db, reset_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path):
    """Point the database at a temp directory for each test."""
    reset_db()
    db = Database(tmp_path / "test_registry.db")
    import app.db as db_module
    db_module._db_instance = db
    yield db
    reset_db()


@pytest.fixture
def sample_input_snapshot() -> dict:
    """A representative input snapshot captured at prediction time."""
    return {
        "matchId": "test-match-001",
        "homeTeam": {"teamId": "team-a", "name": "Team A"},
        "awayTeam": {"teamId": "team-b", "name": "Team B"},
        "lineups": {
            "home": {
                "teamId": "team-a",
                "formation": "4-3-3",
                "players": [
                    {"name": "Player 1", "position": "ST", "recentRating": 7.5},
                ],
            },
            "away": {
                "teamId": "team-b",
                "formation": "4-4-2",
                "players": [
                    {"name": "Player 2", "position": "CB", "recentRating": 6.9},
                ],
            },
        },
        "referee": {"name": "M. Oliver", "cardsPerMatch": 4.2},
    }


@pytest.fixture
def sample_prediction_data() -> dict:
    """A representative prediction output."""
    return {
        "matchId": "test-match-001",
        "homeWin": 55,
        "draw": 25,
        "awayWin": 20,
        "expectedHomeGoals": 1.8,
        "expectedAwayGoals": 1.0,
        "modelName": "Dixon-Coles + Player Rating Adjustment",
        "modelVersion": "1.0.0",
        "confidence": 0.72,
        "explanation": "Test prediction explanation.",
        "goalScorers": [
            {"player": "Player 1", "team": "Team A", "probability": 34},
        ],
        "cardRisks": [
            {"player": "Player 2", "team": "Team B", "yellowRisk": 25, "redCardRisk": "low"},
        ],
    }


@pytest.fixture
def sample_model_info() -> dict:
    """Model metadata for the registry entry."""
    return {
        "modelName": "Dixon-Coles + Player Rating Adjustment",
        "modelVersion": "1.0.0",
        "dataVersion": "mock-1.0.0",
        "providerIds": ["mock-provider"],
        "providerFreshness": {"mock-provider": "just now"},
        "missingFields": [],
        "confidenceCap": 1.0,
        "fallbackMethods": [],
        "degraded": False,
    }


def _seed_match(db: Database) -> None:
    """Insert the demo match into the database."""
    db.upsert_match({
        "matchId": "test-match-001",
        "competition": "Test Cup",
        "kickoff": "2026-06-01T18:00:00Z",
        "status": "scheduled",
        "homeTeam": {"teamId": "team-a", "name": "Team A", "shortName": "TA"},
        "awayTeam": {"teamId": "team-b", "name": "Team B", "shortName": "TB"},
        "score": None,
    })


# ---------------------------------------------------------------------------
# 1. Prediction saves input snapshot
# ---------------------------------------------------------------------------


class TestPredictionSavesInputSnapshot:
    """Every prediction MUST save an immutable input snapshot."""

    def test_save_stores_input_snapshot(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        assert record["predictionId"] is not None
        assert record["matchId"] == "test-match-001"

    def test_input_snapshot_is_persisted(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        retrieved = get_prediction_record(record["predictionId"])

        assert retrieved["inputSnapshot"] is not None
        assert retrieved["inputSnapshot"]["matchId"] == "test-match-001"
        assert retrieved["inputSnapshot"]["referee"]["name"] == "M. Oliver"

    def test_input_snapshot_preserves_lineups(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        retrieved = get_prediction_record(record["predictionId"])

        lineups = retrieved["inputSnapshot"]["lineups"]
        assert lineups["home"]["formation"] == "4-3-3"
        assert lineups["away"]["formation"] == "4-4-2"
        assert len(lineups["home"]["players"]) == 1

    def test_output_snapshot_is_persisted(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        retrieved = get_prediction_record(record["predictionId"])

        output = retrieved["outputSnapshot"]
        assert output["homeWin"] == 55
        assert output["draw"] == 25
        assert output["awayWin"] == 20

    def test_multiple_predictions_for_same_match(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, list_prediction_records

        _seed_match(get_db())

        # Save two predictions
        save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )

        records = list_prediction_records("test-match-001")
        assert len(records) == 2

    def test_empty_input_snapshot_is_allowed(
        self, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot={},
            model_info=sample_model_info,
        )
        retrieved = get_prediction_record(record["predictionId"])
        assert retrieved["inputSnapshot"] == {}


# ---------------------------------------------------------------------------
# 2. Prediction audit trail
# ---------------------------------------------------------------------------


class TestPredictionAuditTrail:
    """Predictions must have a full audit trail with model metadata."""

    def test_audit_includes_model_info(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["modelName"] == "Dixon-Coles + Player Rating Adjustment"
        assert audit["modelVersion"] == "1.0.0"
        assert audit["dataVersion"] == "mock-1.0.0"

    def test_audit_includes_provider_ids(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["providerIds"] == ["mock-provider"]
        assert audit["providerFreshness"] == {"mock-provider": "just now"}

    def test_audit_includes_missing_fields(
        self, sample_input_snapshot, sample_prediction_data
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        model_info = {
            "modelName": "Test Model",
            "modelVersion": "1.0.0",
            "missingFields": ["lineups", "playerStats"],
            "confidenceCap": 0.70,
            "degraded": True,
            "fallbackMethods": ["league_average"],
        }
        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=model_info,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["missingFields"] == ["lineups", "playerStats"]
        assert audit["confidenceCap"] == 0.70
        assert audit["degraded"] is True
        assert audit["fallbackMethods"] == ["league_average"]

    def test_audit_includes_confidence(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["confidence"] == 0.72

    def test_audit_includes_generated_at(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["generatedAt"] is not None

    def test_audit_with_default_model_info(
        self, sample_input_snapshot, sample_prediction_data
    ):
        """When model_info is None, defaults should be used."""
        from app.prediction_registry import save_prediction_record, get_prediction_audit

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=None,
        )
        audit = get_prediction_audit(record["predictionId"])

        assert audit["modelName"] == "Dixon-Coles + Player Rating Adjustment"
        assert audit["degraded"] is False


# ---------------------------------------------------------------------------
# 3. Prediction retrieval
# ---------------------------------------------------------------------------


class TestPredictionRetrieval:
    """Predictions must be retrievable by ID and by match."""

    def test_get_by_id_returns_full_record(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, get_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        retrieved = get_prediction_record(record["predictionId"])

        assert retrieved["predictionId"] == record["predictionId"]
        assert retrieved["matchId"] == "test-match-001"
        assert retrieved["inputSnapshot"] is not None
        assert retrieved["outputSnapshot"] is not None

    def test_get_nonexistent_raises_404(self):
        from app.prediction_registry import get_prediction_record
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            get_prediction_record("preg_nonexistent")
        assert exc_info.value.status_code == 404

    def test_list_by_match_returns_ordered_results(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, list_prediction_records

        _seed_match(get_db())

        # Save multiple predictions
        for i in range(3):
            save_prediction_record(
                match_id="test-match-001",
                prediction_data=sample_prediction_data,
                input_snapshot=sample_input_snapshot,
                model_info=sample_model_info,
            )

        records = list_prediction_records("test-match-001")
        assert len(records) == 3
        # Should be ordered by most recent first
        for i in range(len(records) - 1):
            assert records[i]["generatedAt"] >= records[i + 1]["generatedAt"]

    def test_list_empty_match_returns_empty(self):
        from app.prediction_registry import list_prediction_records

        _seed_match(get_db())

        records = list_prediction_records("test-match-001")
        assert records == []

    def test_different_matches_have_separate_records(
        self, sample_input_snapshot, sample_prediction_data, sample_model_info
    ):
        from app.prediction_registry import save_prediction_record, list_prediction_records

        db = get_db()
        db.upsert_match({
            "matchId": "test-match-002",
            "competition": "Test Cup",
            "kickoff": "2026-06-02T18:00:00Z",
            "status": "scheduled",
            "homeTeam": {"teamId": "team-c", "name": "Team C", "shortName": "TC"},
            "awayTeam": {"teamId": "team-d", "name": "Team D", "shortName": "TD"},
            "score": None,
        })

        save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        save_prediction_record(
            match_id="test-match-002",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )

        records_1 = list_prediction_records("test-match-001")
        records_2 = list_prediction_records("test-match-002")
        assert len(records_1) == 1
        assert len(records_2) == 1
        assert records_1[0]["matchId"] == "test-match-001"
        assert records_2[0]["matchId"] == "test-match-002"

    def test_prediction_id_format(self, sample_prediction_data, sample_input_snapshot, sample_model_info):
        """Prediction IDs should start with 'preg_' prefix."""
        from app.prediction_registry import save_prediction_record

        _seed_match(get_db())

        record = save_prediction_record(
            match_id="test-match-001",
            prediction_data=sample_prediction_data,
            input_snapshot=sample_input_snapshot,
            model_info=sample_model_info,
        )
        assert record["predictionId"].startswith("preg_")

    def test_get_audit_nonexistent_raises_404(self):
        from app.prediction_registry import get_prediction_audit
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            get_prediction_audit("preg_nonexistent")
        assert exc_info.value.status_code == 404
