"""Tests for calibration report and backtest API endpoints."""

import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _clear_admin_token():
    """Ensure no admin token is set so auth is skipped in tests."""
    old = os.environ.pop("LINEUPCAST_ADMIN_TOKEN", None)
    yield
    if old is not None:
        os.environ["LINEUPCAST_ADMIN_TOKEN"] = old


@pytest.fixture()
def client():
    from app.main import app

    return TestClient(app)


class TestCalibrationEndpoint:
    """GET /api/models/{model_id}/calibration"""

    def test_returns_calibration_report_for_known_model(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        assert response.status_code == 200
        data = response.json()
        assert data["modelId"] == "dixon-coles-poisson"
        assert "brierScore" in data
        assert "logLoss" in data
        assert "ece" in data
        assert "eceBins" in data
        assert "calibrationBuckets" in data
        assert "reliabilityCurve" in data
        assert "outcomeClassMetrics" in data
        assert "favoriteUnderdogMetrics" in data
        assert "failureSegments" in data
        assert "confidence" in data
        assert "generatedAt" in data

    def test_calibration_buckets_have_required_fields(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        data = response.json()
        buckets = data["calibrationBuckets"]
        assert isinstance(buckets, list)
        if len(buckets) > 0:
            bucket = buckets[0]
            assert "lowerBound" in bucket
            assert "upperBound" in bucket
            assert "count" in bucket
            assert "averagePrediction" in bucket
            assert "observedRate" in bucket
            assert "gap" in bucket

    def test_reliability_curve_has_favorite_underdog_split(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        data = response.json()
        rc = data["reliabilityCurve"]
        assert "all" in rc
        assert "favorite" in rc
        assert "underdog" in rc
        assert "ece" in rc
        assert "favoriteEce" in rc
        assert "underdogEce" in rc

    def test_outcome_class_metrics_cover_three_outcomes(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        data = response.json()
        outcomes = data["outcomeClassMetrics"]
        assert isinstance(outcomes, list)
        outcome_labels = [o["outcome"] for o in outcomes]
        assert "homeWin" in outcome_labels
        assert "draw" in outcome_labels
        assert "awayWin" in outcome_labels

    def test_favorite_underdog_metrics(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        data = response.json()
        fu = data["favoriteUnderdogMetrics"]
        assert isinstance(fu, list)
        subsets = [f["subset"] for f in fu]
        assert "favorite" in subsets
        assert "underdog" in subsets

    def test_failure_segments_present(self, client: TestClient) -> None:
        response = client.get("/api/models/dixon-coles-poisson/calibration")
        data = response.json()
        segments = data["failureSegments"]
        assert isinstance(segments, list)
        for seg in segments:
            assert "id" in seg
            assert "description" in seg
            assert "count" in seg
            assert "severity" in seg
            assert seg["severity"] in ("warning", "critical")

    def test_returns_404_for_unknown_model(self, client: TestClient) -> None:
        response = client.get("/api/models/nonexistent-model/calibration")
        assert response.status_code == 404

    def test_is_deterministic(self, client: TestClient) -> None:
        r1 = client.get("/api/models/dixon-coles-poisson/calibration")
        r2 = client.get("/api/models/dixon-coles-poisson/calibration")
        # Compare all fields except generatedAt (timestamps may differ)
        d1 = {k: v for k, v in r1.json().items() if k != "generatedAt"}
        d2 = {k: v for k, v in r2.json().items() if k != "generatedAt"}
        assert d1 == d2


class TestModelBacktestEndpoint:
    """POST /api/models/{model_id}/backtest"""

    def test_runs_backtest_for_known_model(self, client: TestClient) -> None:
        response = client.post("/api/models/dixon-coles-poisson/backtest")
        assert response.status_code == 200
        data = response.json()
        assert data["modelId"] == "dixon-coles-poisson"
        assert "sampleSize" in data
        assert "accuracy" in data
        assert "brierScore" in data
        assert "calibration" in data

    def test_returns_404_for_unknown_model(self, client: TestClient) -> None:
        response = client.post("/api/models/nonexistent-model/backtest")
        assert response.status_code == 404

    def test_is_deterministic(self, client: TestClient) -> None:
        r1 = client.post("/api/models/dixon-coles-poisson/backtest")
        r2 = client.post("/api/models/dixon-coles-poisson/backtest")
        assert r1.json() == r2.json()
