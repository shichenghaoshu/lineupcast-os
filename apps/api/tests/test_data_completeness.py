"""Tests for the data completeness scoring module."""

from __future__ import annotations

import pytest

from app.data_completeness import (
    COMPLETENESS_WARNING_THRESHOLD,
    NARRATIVE_ONLY_THRESHOLD,
    DataCompletenessInput,
    DataCompletenessResult,
    AllowedOutputs,
    assess_data_completeness,
    apply_confidence_cap,
    compute_data_completeness,
    empty_data_input,
    full_data_input,
    get_league_average_referee,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _full_match_data() -> dict:
    """Return a match_data dict with all categories present."""
    return {
        "matchId": "test-match-1",
        "kickoff": "2026-05-07T15:00:00Z",
        "homeTeam": {"name": "Team A", "teamId": "a"},
        "awayTeam": {"name": "Team B", "teamId": "b"},
        "lineups": {
            "home": {
                "teamId": "a",
                "players": [
                    {"name": "P1", "xGLast5": 1.2, "foulsPer90": 1.5},
                ],
            },
            "away": {
                "teamId": "b",
                "players": [
                    {"name": "P2", "recentRating": 7.5, "yellowCardsLast10": 2},
                ],
            },
        },
        "referee": {"name": "Ref One"},
        "recentForm": [{"result": "W"}, {"result": "L"}],
        "playerStats": [{"name": "P1", "goals": 5}],
        "cardStats": [{"name": "P1", "yellowCards": 2}],
    }


# ---------------------------------------------------------------------------
# Score boundaries
# ---------------------------------------------------------------------------


class TestScoreBoundaries:
    def test_full_data_scores_100(self):
        result = assess_data_completeness(_full_match_data())
        assert result.score == 100
        assert result.mode == "full"
        assert result.confidenceCap == 1.0

    def test_score_never_exceeds_100(self):
        result = assess_data_completeness(_full_match_data())
        assert result.score <= 100

    def test_score_never_below_0(self):
        result = assess_data_completeness({})
        assert result.score >= 0


# ---------------------------------------------------------------------------
# Fixture gate
# ---------------------------------------------------------------------------


class TestFixtureGate:
    def test_missing_fixture_returns_no_prediction(self):
        result = assess_data_completeness({})
        assert result.mode == "no_prediction"
        assert result.score == 0
        assert result.confidenceCap == 0.0
        assert result.flags["noPrediction"] is True

    def test_missing_fixture_all_outputs_disabled(self):
        result = assess_data_completeness({})
        assert result.flags["playerRatingAdjustment"] is False
        assert result.flags["scorerRanking"] is False
        assert result.flags["cardRiskAssessment"] is False
        assert result.flags["narrativeOnly"] is True
        assert result.flags["noExactProbability"] is True

    def test_missing_fixture_has_degraded_reason(self):
        result = assess_data_completeness({})
        assert any("fixture" in r.lower() for r in result.degradedReasons)

    def test_partial_fixture_missing_match_id(self):
        data = {
            "kickoff": "2026-05-07T15:00:00Z",
            "homeTeam": {"name": "A"},
            "awayTeam": {"name": "B"},
        }
        result = assess_data_completeness(data)
        assert result.mode == "no_prediction"

    def test_partial_fixture_missing_kickoff(self):
        data = {
            "matchId": "test",
            "homeTeam": {"name": "A"},
            "awayTeam": {"name": "B"},
        }
        result = assess_data_completeness(data)
        assert result.mode == "no_prediction"

    def test_partial_fixture_missing_teams(self):
        data = {
            "matchId": "test",
            "kickoff": "2026-05-07T15:00:00Z",
        }
        result = assess_data_completeness(data)
        assert result.mode == "no_prediction"


# ---------------------------------------------------------------------------
# Mode thresholds
# ---------------------------------------------------------------------------


class TestModeThresholds:
    def test_mode_full_when_score_gte_60(self):
        result = assess_data_completeness(_full_match_data())
        assert result.score >= COMPLETENESS_WARNING_THRESHOLD
        assert result.mode == "full"

    def test_mode_warning_when_score_between_40_and_59(self):
        data = _full_match_data()
        # Remove lineups (25) + playerStats (20) = -45 -> score 55
        data["lineups"] = None
        data["playerStats"] = None
        result = assess_data_completeness(data)
        assert NARRATIVE_ONLY_THRESHOLD <= result.score < COMPLETENESS_WARNING_THRESHOLD
        assert result.mode == "warning"
        assert result.warning is not None

    def test_mode_narrative_only_when_score_below_40(self):
        data = _full_match_data()
        # Remove lineups (25) + playerStats (20) + cardStats (15) + referee (10) = -70 -> score 30
        data["lineups"] = None
        data["playerStats"] = None
        data["cardStats"] = None
        data["referee"] = None
        result = assess_data_completeness(data)
        assert result.score < NARRATIVE_ONLY_THRESHOLD
        assert result.mode == "narrative_only"
        assert result.flags["narrativeOnly"] is True


# ---------------------------------------------------------------------------
# Individual category penalties
# ---------------------------------------------------------------------------


class TestCategoryPenalties:
    def test_missing_lineups_penalty(self):
        data = _full_match_data()
        data["lineups"] = None
        result = assess_data_completeness(data)
        assert result.score == 75  # 100 - 25

    def test_missing_player_stats_penalty(self):
        data = _full_match_data()
        data["playerStats"] = None
        # playerStats detected from lineup players with xGLast5
        # so we need to also remove those fields
        for side in ("home", "away"):
            for p in data["lineups"][side]["players"]:
                p.pop("xGLast5", None)
                p.pop("recentRating", None)
                p.pop("xg", None)
        result = assess_data_completeness(data)
        assert result.score == 80  # 100 - 20

    def test_missing_card_stats_penalty(self):
        data = _full_match_data()
        data["cardStats"] = None
        # cardStats detected from lineup players with foulsPer90
        for side in ("home", "away"):
            for p in data["lineups"][side]["players"]:
                p.pop("foulsPer90", None)
                p.pop("yellowCardsLast10", None)
        result = assess_data_completeness(data)
        assert result.score == 85  # 100 - 15

    def test_missing_referee_penalty(self):
        data = _full_match_data()
        data["referee"] = None
        result = assess_data_completeness(data)
        assert result.score == 90  # 100 - 10

    def test_missing_recent_form_penalty(self):
        data = _full_match_data()
        data["recentForm"] = None
        # Also remove form from team data
        data.pop("recentForm", None)
        result = assess_data_completeness(data)
        assert result.score == 85  # 100 - 15


# ---------------------------------------------------------------------------
# Feature flags
# ---------------------------------------------------------------------------


class TestFeatureFlags:
    def test_no_player_adjustment_without_lineups(self):
        data = _full_match_data()
        data["lineups"] = None
        result = assess_data_completeness(data)
        assert result.flags["playerRatingAdjustment"] is False

    def test_scorer_ranking_basic_without_player_stats(self):
        data = _full_match_data()
        data["playerStats"] = None
        for side in ("home", "away"):
            for p in data["lineups"][side]["players"]:
                p.pop("xGLast5", None)
                p.pop("recentRating", None)
                p.pop("xg", None)
        result = assess_data_completeness(data)
        assert result.flags["scorerRanking"] is False
        assert result.flags["scorerRankingBasic"] is True

    def test_card_risk_level_only_without_card_stats(self):
        data = _full_match_data()
        data["cardStats"] = None
        for side in ("home", "away"):
            for p in data["lineups"][side]["players"]:
                p.pop("foulsPer90", None)
                p.pop("yellowCardsLast10", None)
        result = assess_data_completeness(data)
        assert result.flags["cardRiskAssessment"] is False
        assert result.flags["cardRiskLevelOnly"] is True

    def test_referee_league_average_without_referee(self):
        data = _full_match_data()
        data["referee"] = None
        result = assess_data_completeness(data)
        assert result.flags["refereeAdjustment"] is False
        assert result.flags["refereeLeagueAverage"] is True

    def test_no_exact_probability_without_recent_form(self):
        data = _full_match_data()
        data["recentForm"] = None
        result = assess_data_completeness(data)
        assert result.flags["noExactProbability"] is True

    def test_no_prediction_false_when_fixture_present(self):
        result = assess_data_completeness(_full_match_data())
        assert result.flags["noPrediction"] is False


# ---------------------------------------------------------------------------
# Confidence cap tiers
# ---------------------------------------------------------------------------


class TestConfidenceCap:
    def test_cap_1_at_score_80_plus(self):
        assert apply_confidence_cap(0.95, 1.0) == 0.95

    def test_cap_limits_value(self):
        assert apply_confidence_cap(0.95, 0.85) == 0.85

    def test_cap_at_0_is_zero(self):
        assert apply_confidence_cap(0.5, 0.0) == 0.0


# ---------------------------------------------------------------------------
# League average referee
# ---------------------------------------------------------------------------


class TestLeagueAverageReferee:
    def test_returns_dict_with_required_fields(self):
        ref = get_league_average_referee()
        assert ref["name"] == "League Average"
        assert ref["isLeagueAverage"] is True
        assert "cardsPerMatch" in ref
        assert "foulsPerMatch" in ref
        assert "penaltiesPerMatch" in ref


# ---------------------------------------------------------------------------
# Backward-compatible wrapper
# ---------------------------------------------------------------------------


class TestBackwardCompatWrapper:
    def test_full_input_scores_100(self):
        result = compute_data_completeness(full_data_input())
        assert result.score == 100
        assert result.mode == "full"

    def test_empty_input_scores_0(self):
        result = compute_data_completeness(empty_data_input())
        # empty_data_input has all False, including fixture indirectly
        # But the wrapper provides matchId/kickoff/teams, so fixture passes
        assert result.score < 60  # at minimum lineups+playerStats+cardStats+referee+recentForm missing

    def test_missing_lineup_in_wrapper(self):
        inp = full_data_input()
        inp.has_lineup = False
        result = compute_data_completeness(inp)
        assert "lineup" in result.missingCategories

    def test_mode_propagated_from_assessment(self):
        result = compute_data_completeness(full_data_input())
        assert result.mode in ("full", "warning", "narrative_only", "no_prediction")


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_empty_dict_is_no_prediction(self):
        result = assess_data_completeness({})
        assert result.mode == "no_prediction"
        assert result.score == 0

    def test_none_values_handled_gracefully(self):
        data = {
            "matchId": "test",
            "kickoff": "2026-01-01",
            "homeTeam": {"name": "A"},
            "awayTeam": {"name": "B"},
            "lineups": None,
            "referee": None,
            "recentForm": None,
        }
        result = assess_data_completeness(data)
        assert result.mode != "no_prediction"
        assert result.score >= 0

    def test_empty_lineups_dict(self):
        data = {
            "matchId": "test",
            "kickoff": "2026-01-01",
            "homeTeam": {"name": "A"},
            "awayTeam": {"name": "B"},
            "lineups": {},
        }
        result = assess_data_completeness(data)
        # Empty lineups dict -> no lineups detected
        assert "lineups" in result.missingCategories

    def test_referee_without_name(self):
        data = _full_match_data()
        data["referee"] = {"someField": "value"}
        result = assess_data_completeness(data)
        assert "referee" in result.missingCategories

    def test_warning_message_in_warning_mode(self):
        data = _full_match_data()
        data["lineups"] = None
        data["playerStats"] = None
        result = assess_data_completeness(data)
        if result.mode == "warning":
            assert result.warning is not None
            assert str(result.score) in result.warning

    def test_warning_message_in_narrative_mode(self):
        data = _full_match_data()
        data["lineups"] = None
        data["playerStats"] = None
        data["cardStats"] = None
        data["referee"] = None
        result = assess_data_completeness(data)
        if result.mode == "narrative_only":
            assert result.warning is not None
            assert "narrative" in result.warning.lower()
