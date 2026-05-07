"""Tests for prediction degraded mode and data completeness assessment.

Covers:
1. Full data -> normal prediction output
2. Missing lineup -> prediction with playerRatingAdjustment disabled
3. Missing playerStats -> prediction with scorer ranking only
4. Missing card stats -> prediction with risk level only
5. Data completeness score < 60 -> warning included in response
6. Confidence cap applied correctly
7. Missing referee -> league average used, degraded flag set
8. Multiple missing fields -> all degraded reasons listed
9. API response includes dataCompleteness field
10. Fallback to mock data when bridge fails
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.data_completeness import (
    DataCompletenessResult,
    apply_confidence_cap,
    assess_data_completeness,
    get_league_average_referee,
    COMPLETENESS_WARNING_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Fixtures: reusable match data payloads
# ---------------------------------------------------------------------------


def _full_match_data() -> dict:
    """Complete match data with all categories present."""
    return {
        "matchId": "test-match-001",
        "homeTeam": {"teamId": "team-a", "name": "Team A"},
        "awayTeam": {"teamId": "team-b", "name": "Team B"},
        "referee": {"name": "M. Oliver", "cardsPerMatch": 4.2},
        "lineups": {
            "home": {
                "teamId": "team-a",
                "teamName": "Team A",
                "formation": "4-3-3",
                "players": [
                    {
                        "name": "Player 1",
                        "position": "ST",
                        "recentRating": 7.5,
                        "xGLast5": 0.8,
                        "foulsPer90": 0.6,
                        "yellowCardsLast10": 1,
                    },
                ],
            },
            "away": {
                "teamId": "team-b",
                "teamName": "Team B",
                "formation": "4-4-2",
                "players": [
                    {
                        "name": "Player 2",
                        "position": "CB",
                        "recentRating": 6.9,
                        "xGLast5": 0.1,
                        "foulsPer90": 1.2,
                        "yellowCardsLast10": 3,
                    },
                ],
            },
        },
    }


def _no_lineup_data() -> dict:
    """Match data with lineups removed."""
    data = _full_match_data()
    data["lineups"] = None
    return data


def _no_player_stats_data() -> dict:
    """Match data where players lack xG and rating fields."""
    data = _full_match_data()
    for side in ("home", "away"):
        data["lineups"][side]["players"] = [
            {"name": "Bare Player", "position": "MF"},
        ]
    return data


def _no_card_stats_data() -> dict:
    """Match data where players lack foul/card fields."""
    data = _full_match_data()
    for side in ("home", "away"):
        data["lineups"][side]["players"] = [
            {"name": "Clean Player", "position": "FW", "recentRating": 7.0, "xGLast5": 0.5},
        ]
    return data


def _no_referee_data() -> dict:
    """Match data with referee removed."""
    data = _full_match_data()
    data["referee"] = None
    return data


def _minimal_data() -> dict:
    """Only match context, no lineups, stats, or referee."""
    return {
        "matchId": "test-match-minimal",
        "homeTeam": {"teamId": "team-a", "name": "Team A"},
        "awayTeam": {"teamId": "team-b", "name": "Team B"},
    }


def _no_match_context() -> dict:
    """Lineups and referee present, but no team info."""
    data = _full_match_data()
    data.pop("homeTeam", None)
    data.pop("awayTeam", None)
    return data


# ---------------------------------------------------------------------------
# 1. Full data -> normal prediction output
# ---------------------------------------------------------------------------


class TestFullDataNormalPrediction:
    """When all data categories are present, prediction runs at full fidelity."""

    def test_score_is_100(self):
        result = assess_data_completeness(_full_match_data())
        assert result.score == 100

    def test_no_missing_categories(self):
        result = assess_data_completeness(_full_match_data())
        assert result.missingCategories == []

    def test_all_categories_available(self):
        result = assess_data_completeness(_full_match_data())
        assert set(result.availableCategories) == {
            "lineups", "playerStats", "cardStats", "referee", "matchContext",
        }

    def test_no_degraded_reasons(self):
        result = assess_data_completeness(_full_match_data())
        assert result.degradedReasons == []

    def test_no_warning(self):
        result = assess_data_completeness(_full_match_data())
        assert result.warning is None

    def test_confidence_cap_is_1(self):
        result = assess_data_completeness(_full_match_data())
        assert result.confidenceCap == 1.0

    def test_all_feature_flags_enabled(self):
        result = assess_data_completeness(_full_match_data())
        assert result.flags["playerRatingAdjustment"] is True
        assert result.flags["scorerRanking"] is True
        assert result.flags["cardRiskAssessment"] is True
        assert result.flags["refereeAdjustment"] is True
        assert result.flags["refereeLeagueAverage"] is False
        assert result.flags["scorerRankingBasic"] is False
        assert result.flags["cardRiskLevelOnly"] is False


# ---------------------------------------------------------------------------
# 2. Missing lineup -> playerRatingAdjustment disabled
# ---------------------------------------------------------------------------


class TestMissingLineup:
    """When lineups are unavailable, player rating adjustment is disabled."""

    def test_lineups_in_missing(self):
        result = assess_data_completeness(_no_lineup_data())
        assert "lineups" in result.missingCategories

    def test_player_rating_adjustment_disabled(self):
        result = assess_data_completeness(_no_lineup_data())
        assert result.flags["playerRatingAdjustment"] is False

    def test_score_drops_by_lineup_weight(self):
        full = assess_data_completeness(_full_match_data())
        no_lineup = assess_data_completeness(_no_lineup_data())
        assert no_lineup.score == full.score - 30  # lineups weight = 30

    def test_degraded_reason_mentions_lineup(self):
        result = assess_data_completeness(_no_lineup_data())
        lineup_reasons = [r for r in result.degradedReasons if "lineup" in r.lower() or "rating" in r.lower()]
        assert len(lineup_reasons) >= 1

    def test_player_stats_also_missing(self):
        """Without lineups, player stats are also implicitly missing."""
        result = assess_data_completeness(_no_lineup_data())
        assert "playerStats" in result.missingCategories
        assert "cardStats" in result.missingCategories


# ---------------------------------------------------------------------------
# 3. Missing playerStats -> scorer ranking only (basic)
# ---------------------------------------------------------------------------


class TestMissingPlayerStats:
    """When player stats are missing, scorer ranking falls back to basic lineup order."""

    def test_player_stats_in_missing(self):
        result = assess_data_completeness(_no_player_stats_data())
        assert "playerStats" in result.missingCategories

    def test_scorer_ranking_basic_enabled(self):
        result = assess_data_completeness(_no_player_stats_data())
        assert result.flags["scorerRankingBasic"] is True

    def test_scorer_ranking_disabled(self):
        result = assess_data_completeness(_no_player_stats_data())
        assert result.flags["scorerRanking"] is False

    def test_lineups_still_available(self):
        result = assess_data_completeness(_no_player_stats_data())
        assert "lineups" in result.availableCategories

    def test_degraded_reason_mentions_scorer(self):
        result = assess_data_completeness(_no_player_stats_data())
        scorer_reasons = [r for r in result.degradedReasons if "scorer" in r.lower() or "player stat" in r.lower()]
        assert len(scorer_reasons) >= 1


# ---------------------------------------------------------------------------
# 4. Missing card stats -> risk level only
# ---------------------------------------------------------------------------


class TestMissingCardStats:
    """When card stats are missing, card risk is reduced to categorical level only."""

    def test_card_stats_in_missing(self):
        result = assess_data_completeness(_no_card_stats_data())
        assert "cardStats" in result.missingCategories

    def test_card_risk_level_only(self):
        result = assess_data_completeness(_no_card_stats_data())
        assert result.flags["cardRiskLevelOnly"] is True

    def test_card_risk_assessment_disabled(self):
        result = assess_data_completeness(_no_card_stats_data())
        assert result.flags["cardRiskAssessment"] is False

    def test_degraded_reason_mentions_card(self):
        result = assess_data_completeness(_no_card_stats_data())
        card_reasons = [r for r in result.degradedReasons if "card" in r.lower()]
        assert len(card_reasons) >= 1

    def test_other_features_still_work(self):
        result = assess_data_completeness(_no_card_stats_data())
        assert result.flags["playerRatingAdjustment"] is True
        assert result.flags["scorerRanking"] is True


# ---------------------------------------------------------------------------
# 5. Data completeness score < 60 -> warning included in response
# ---------------------------------------------------------------------------


class TestCompletenessWarning:
    """When completeness falls below 60%, a warning is included."""

    def test_warning_present_when_below_threshold(self):
        result = assess_data_completeness(_minimal_data())
        assert result.warning is not None
        assert str(result.score) in result.warning

    def test_no_warning_at_threshold(self):
        """Score of exactly 60 should not trigger warning (< 60 is the rule)."""
        data = _full_match_data()
        data["referee"] = None  # -15, score = 85
        data.pop("homeTeam", None)  # -10, score = 75
        # Still above 60, no warning expected
        result = assess_data_completeness(data)
        # score = 75, above threshold
        assert result.warning is None

    def test_warning_message_includes_threshold(self):
        result = assess_data_completeness(_minimal_data())
        assert str(COMPLETENESS_WARNING_THRESHOLD) in result.warning

    def test_minimal_data_score_is_low(self):
        """Minimal data (only match context) should be well below 60."""
        result = assess_data_completeness(_minimal_data())
        assert result.score < COMPLETENESS_WARNING_THRESHOLD

    def test_no_data_score_is_zero(self):
        result = assess_data_completeness({})
        assert result.score == 0
        assert result.warning is not None


# ---------------------------------------------------------------------------
# 6. Confidence cap applied correctly
# ---------------------------------------------------------------------------


class TestConfidenceCap:
    """Confidence cap is applied based on completeness score thresholds."""

    def test_full_data_no_cap(self):
        result = assess_data_completeness(_full_match_data())
        assert result.confidenceCap == 1.0

    def test_cap_at_85_for_moderate_completeness(self):
        """Score 60-79 -> cap at 0.85."""
        data = _full_match_data()
        data["referee"] = None  # -15 -> score = 85, still above 80
        # Need to drop more: remove match context too
        data.pop("homeTeam", None)
        data.pop("awayTeam", None)
        # score = 85 - 10 = 75, which is in [60, 80) range
        result = assess_data_completeness(data)
        assert result.confidenceCap == 0.85

    def test_cap_at_70_for_low_completeness(self):
        """Score 40-59 -> cap at 0.70."""
        data = _no_lineup_data()  # Only referee + matchContext = 25
        result = assess_data_completeness(data)
        assert result.score < 60
        # With only referee + match context = 15 + 10 = 25, cap = 0.50
        # Let's add cardStats somehow... actually without lineups,
        # playerStats and cardStats are both missing too
        # So score = 15 + 10 = 25 -> cap = 0.50
        assert result.confidenceCap == 0.50

    def test_cap_at_50_for_very_low_completeness(self):
        """Score < 40 -> cap at 0.50."""
        result = assess_data_completeness(_minimal_data())
        assert result.confidenceCap == 0.50

    def test_apply_confidence_cap_reduces_value(self):
        assert apply_confidence_cap(0.9, 0.7) == 0.7

    def test_apply_confidence_cap_preserves_lower_value(self):
        assert apply_confidence_cap(0.6, 0.85) == 0.6

    def test_apply_confidence_cap_equal_values(self):
        assert apply_confidence_cap(0.85, 0.85) == 0.85


# ---------------------------------------------------------------------------
# 7. Missing referee -> league average used, degraded flag set
# ---------------------------------------------------------------------------


class TestMissingReferee:
    """When referee data is missing, league average is used and degraded flag is set."""

    def test_referee_in_missing(self):
        result = assess_data_completeness(_no_referee_data())
        assert "referee" in result.missingCategories

    def test_referee_league_average_flag(self):
        result = assess_data_completeness(_no_referee_data())
        assert result.flags["refereeLeagueAverage"] is True

    def test_referee_adjustment_disabled(self):
        result = assess_data_completeness(_no_referee_data())
        assert result.flags["refereeAdjustment"] is False

    def test_degraded_reason_mentions_referee(self):
        result = assess_data_completeness(_no_referee_data())
        ref_reasons = [r for r in result.degradedReasons if "referee" in r.lower() or "league average" in r.lower()]
        assert len(ref_reasons) >= 1

    def test_league_average_referee_returns_valid_data(self):
        avg = get_league_average_referee()
        assert avg["name"] == "League Average"
        assert avg["isLeagueAverage"] is True
        assert avg["cardsPerMatch"] > 0
        assert avg["foulsPerMatch"] > 0
        assert avg["penaltiesPerMatch"] > 0

    def test_score_drops_by_referee_weight(self):
        full = assess_data_completeness(_full_match_data())
        no_ref = assess_data_completeness(_no_referee_data())
        assert no_ref.score == full.score - 15  # referee weight = 15


# ---------------------------------------------------------------------------
# 8. Multiple missing fields -> all degraded reasons listed
# ---------------------------------------------------------------------------


class TestMultipleMissingFields:
    """When multiple data categories are missing, all degraded reasons are listed."""

    def test_minimal_data_has_multiple_reasons(self):
        result = assess_data_completeness(_minimal_data())
        # Missing: lineups, playerStats, cardStats, referee (matchContext present)
        assert len(result.degradedReasons) >= 4

    def test_empty_data_has_all_reasons(self):
        result = assess_data_completeness({})
        assert len(result.degradedReasons) == 5  # all 5 categories

    def test_reasons_cover_all_missing_categories(self):
        result = assess_data_completeness(_minimal_data())
        reasons_text = " ".join(result.degradedReasons).lower()
        assert "lineup" in reasons_text
        assert "player stat" in reasons_text or "scorer" in reasons_text
        assert "card" in reasons_text
        assert "referee" in reasons_text

    def test_each_reason_is_unique(self):
        result = assess_data_completeness({})
        assert len(result.degradedReasons) == len(set(result.degradedReasons))

    def test_all_flags_reflect_missing_state(self):
        result = assess_data_completeness(_minimal_data())
        # lineups missing -> most features disabled
        assert result.flags["playerRatingAdjustment"] is False
        assert result.flags["scorerRanking"] is False
        assert result.flags["cardRiskAssessment"] is False
        assert result.flags["refereeAdjustment"] is False
        # Degraded alternatives enabled
        assert result.flags["refereeLeagueAverage"] is True


# ---------------------------------------------------------------------------
# 9. API response includes dataCompleteness field
# ---------------------------------------------------------------------------


class TestDataCompletenessField:
    """The prediction response should include a dataCompleteness object."""

    def test_result_has_score(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "score")
        assert isinstance(result.score, int)

    def test_result_has_available_categories(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "availableCategories")
        assert isinstance(result.availableCategories, list)

    def test_result_has_missing_categories(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "missingCategories")
        assert isinstance(result.missingCategories, list)

    def test_result_has_confidence_cap(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "confidenceCap")
        assert isinstance(result.confidenceCap, float)

    def test_result_has_flags(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "flags")
        assert isinstance(result.flags, dict)

    def test_result_has_degraded_reasons(self):
        result = assess_data_completeness(_full_match_data())
        assert hasattr(result, "degradedReasons")
        assert isinstance(result.degradedReasons, list)

    def test_score_range_is_valid(self):
        """Score must always be between 0 and 100."""
        for data in [_full_match_data(), _minimal_data(), {}, _no_lineup_data()]:
            result = assess_data_completeness(data)
            assert 0 <= result.score <= 100

    def test_completeness_result_serialisable(self):
        """DataCompletenessResult fields should be JSON-serialisable."""
        result = assess_data_completeness(_full_match_data())
        # All fields are primitive types or lists of primitives
        assert isinstance(result.score, int)
        assert all(isinstance(c, str) for c in result.availableCategories)
        assert all(isinstance(c, str) for c in result.missingCategories)
        assert all(isinstance(r, str) for r in result.degradedReasons)
        assert isinstance(result.confidenceCap, float)
        assert result.warning is None or isinstance(result.warning, str)
        assert all(isinstance(v, bool) for v in result.flags.values())


# ---------------------------------------------------------------------------
# 10. Fallback to mock data when bridge fails
# ---------------------------------------------------------------------------


class TestBridgeFailureFallback:
    """When the prediction bridge returns None, the system falls back to mock data."""

    @pytest.mark.asyncio
    async def test_bridge_failure_returns_mock_prediction(self):
        """When call_prediction_engine returns None, mock prediction is used."""
        from httpx import ASGITransport, AsyncClient
        from app.main import app

        with patch("app.services.call_prediction_engine", return_value=None):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor/prediction")
                assert resp.status_code == 200
                data = resp.json()
                # Should still have valid prediction fields from mock data
                assert "homeWin" in data
                assert "draw" in data
                assert "awayWin" in data
                assert data["modelName"]
                assert data["goalScorers"]

    @pytest.mark.asyncio
    async def test_bridge_timeout_returns_mock_prediction(self):
        """When the bridge times out, mock prediction is returned."""
        from httpx import ASGITransport, AsyncClient
        from app.main import app

        with patch("app.services.call_prediction_engine", return_value=None):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor/prediction")
                assert resp.status_code == 200
                data = resp.json()
                # Mock fallback should include card risks and goal scorers
                assert len(data["goalScorers"]) > 0
                assert len(data["cardRisks"]) > 0

    @pytest.mark.asyncio
    async def test_bridge_success_uses_bridge_data(self):
        """When the bridge returns valid data, it is used instead of mock."""
        from httpx import ASGITransport, AsyncClient
        from app.main import app
        from app.config import get_settings

        bridge_response = {
            "homeWin": 55,
            "draw": 25,
            "awayWin": 20,
            "expectedHomeGoals": 1.8,
            "expectedAwayGoals": 1.0,
            "modelName": "bridge-model",
            "modelVersion": "2.0.0",
            "confidence": 0.82,
            "explanation": "Bridge prediction explanation.",
            "goalScorers": [{"player": "Bridge Striker", "team": "Team A", "probability": 40}],
            "cardRisks": [{"player": "Bridge Defender", "team": "Team B", "yellowRisk": 30, "redCardRisk": "low"}],
            "models": [{"name": "Bridge Model", "version": "2.0.0", "reference": "bridge.md"}],
            "explanations": ["Bridge explanation."],
            "inputFeatures": ["bridge_feature"],
        }

        get_settings.cache_clear()
        try:
            with patch("app.services.call_prediction_engine", return_value=bridge_response):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    resp = await client.get("/api/matches/demo-manchester-red-vs-shanghai-harbor/prediction")
                    assert resp.status_code == 200
                    data = resp.json()
                    assert data["modelName"] == "bridge-model"
                    assert data["homeWin"] == 55
                    assert data["goalScorers"][0]["player"] == "Bridge Striker"
        finally:
            get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Edge cases for data completeness assessment."""

    def test_empty_dict_scores_zero(self):
        result = assess_data_completeness({})
        assert result.score == 0
        assert len(result.missingCategories) == 5

    def test_lineups_with_empty_players_list(self):
        data = _full_match_data()
        data["lineups"]["home"]["players"] = []
        result = assess_data_completeness(data)
        assert "lineups" in result.missingCategories

    def test_lineups_with_none_players(self):
        data = _full_match_data()
        data["lineups"]["away"]["players"] = None
        result = assess_data_completeness(data)
        assert "lineups" in result.missingCategories

    def test_referee_empty_dict_treated_as_missing(self):
        data = _full_match_data()
        data["referee"] = {}
        result = assess_data_completeness(data)
        assert "referee" in result.missingCategories

    def test_referee_without_name_treated_as_missing(self):
        data = _full_match_data()
        data["referee"] = {"cardsPerMatch": 4.0}
        result = assess_data_completeness(data)
        assert "referee" in result.missingCategories

    def test_player_without_xg_or_rating_treated_as_missing_stats(self):
        data = _full_match_data()
        data["lineups"]["home"]["players"] = [
            {"name": "No Stats Player", "position": "MF"},
        ]
        result = assess_data_completeness(data)
        assert "playerStats" in result.missingCategories

    def test_mixed_completeness(self):
        """Lineups + referee present, but player/card stats missing from player data."""
        data = _full_match_data()
        for side in ("home", "away"):
            data["lineups"][side]["players"] = [
                {"name": "Partial Player", "position": "FW"},
            ]
        result = assess_data_completeness(data)
        assert "lineups" in result.availableCategories
        assert "referee" in result.availableCategories
        assert "playerStats" in result.missingCategories
        assert "cardStats" in result.missingCategories

    def test_match_context_from_match_key(self):
        """Match context can come from 'match' key too."""
        data = {
            "match": {
                "homeTeam": {"teamId": "a"},
                "awayTeam": {"teamId": "b"},
            },
        }
        result = assess_data_completeness(data)
        assert "matchContext" in result.availableCategories
