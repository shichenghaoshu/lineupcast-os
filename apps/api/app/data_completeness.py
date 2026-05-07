"""Data completeness scoring for match predictions.

Evaluates how much data is available for a given match prediction.
The result drives a confidence cap and determines which prediction
outputs are safe to display.

Modes:
  - full (score >= 60): all prediction outputs enabled
  - warning (score < 60): confidence capped, some outputs disabled
  - narrative_only (score < 40): only narrative/commentary safe
  - no_prediction (missing fixture): no prediction possible
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# ---------------------------------------------------------------------------
# Result class
# ---------------------------------------------------------------------------

PredictionMode = Literal["full", "warning", "narrative_only", "no_prediction"]


@dataclass
class DataCompletenessResult:
    """Result of a data completeness assessment."""

    score: int  # 0-100
    mode: PredictionMode = "full"
    availableCategories: list[str] = field(default_factory=list)
    missingCategories: list[str] = field(default_factory=list)
    degradedReasons: list[str] = field(default_factory=list)
    warning: str | None = None
    confidenceCap: float = 1.0
    flags: dict[str, bool] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COMPLETENESS_WARNING_THRESHOLD = 60
NARRATIVE_ONLY_THRESHOLD = 40

# Category weights (total = 100)
# playerStats and cardStats have weight 0 when lineups is missing
# because they're implicitly missing (can't have stats without lineups)
_CATEGORY_WEIGHTS = {
    "lineups": 25,
    "playerStats": 20,
    "cardStats": 15,
    "referee": 10,
    "recentForm": 15,
    "matchContext": 15,
}

# Weights that are zeroed when lineups is missing
_LINEUP_DEPENDENT = {"playerStats", "cardStats"}

# Tiered confidence caps
_CAPS_BY_SCORE = [
    (80, 1.0),
    (60, 0.85),
    (40, 0.70),
    (0, 0.50),
]


# ---------------------------------------------------------------------------
# Core assessment function
# ---------------------------------------------------------------------------


def assess_data_completeness(match_data: dict) -> DataCompletenessResult:
    """Assess data completeness from a raw match data dict.

    Parameters
    ----------
    match_data:
        A dictionary containing match data. Expected keys include
        ``lineups``, ``playerStats``/``players``, ``cardStats``/``cards``,
        ``referee``, ``recentForm``, ``homeTeam``, ``awayTeam``,
        ``matchId``, ``kickoff``.

    Returns
    -------
    DataCompletenessResult
        The completeness assessment with score, categories, mode, flags, etc.
    """
    available: list[str] = []
    missing: list[str] = []
    reasons: list[str] = []
    flags: dict[str, bool] = {}

    # ── Fixture gate ─────────────────────────────────────────────────────
    # If the match fixture itself is missing, no prediction is possible.

    has_fixture = _has_fixture(match_data)
    if not has_fixture:
        reasons.append("Missing fixture data — no prediction possible")
        return DataCompletenessResult(
            score=0,
            mode="no_prediction",
            availableCategories=[],
            missingCategories=["fixture"],
            degradedReasons=reasons,
            warning="Missing fixture data. No prediction can be generated.",
            confidenceCap=0.0,
            flags={
                "noPrediction": True,
                "playerRatingAdjustment": False,
                "scorerRanking": False,
                "scorerRankingBasic": False,
                "cardRiskAssessment": False,
                "cardRiskLevelOnly": False,
                "refereeAdjustment": False,
                "refereeLeagueAverage": True,
                "noExactProbability": True,
                "narrativeOnly": True,
            },
        )

    # ── Check each category ──────────────────────────────────────────────

    # Lineups
    has_lineups = _has_lineups(match_data)
    _record("lineups", has_lineups, available, missing, reasons)

    # Player stats
    has_player_stats = _has_player_stats(match_data)
    _record("playerStats", has_player_stats, available, missing, reasons)

    # Card stats
    has_card_stats = _has_card_stats(match_data)
    _record("cardStats", has_card_stats, available, missing, reasons)

    # Referee
    has_referee = _has_referee(match_data)
    _record("referee", has_referee, available, missing, reasons)

    # Recent form
    has_recent_form = _has_recent_form(match_data)
    _record("recentForm", has_recent_form, available, missing, reasons)

    # Match context (team info)
    has_match_context = _has_match_context(match_data)
    _record("matchContext", has_match_context, available, missing, reasons)

    # ── Compute score ────────────────────────────────────────────────────

    score = 100
    lineups_missing = "lineups" in missing
    for cat in missing:
        weight = _CATEGORY_WEIGHTS.get(cat, 0)
        # playerStats and cardStats have weight 0 when lineups is missing
        if lineups_missing and cat in _LINEUP_DEPENDENT:
            weight = 0
        score -= weight
    score = max(0, score)

    # ── Confidence cap ───────────────────────────────────────────────────

    confidence_cap = _cap_for_score(score)

    # ── Mode determination ───────────────────────────────────────────────
    # full (>= 60): all outputs enabled
    # warning (< 60): confidence capped, some outputs disabled
    # narrative_only (< 40): only narrative/commentary safe

    if score < NARRATIVE_ONLY_THRESHOLD:
        mode: PredictionMode = "narrative_only"
    elif score < COMPLETENESS_WARNING_THRESHOLD:
        mode = "warning"
    else:
        mode = "full"

    # ── Warning ──────────────────────────────────────────────────────────

    warning = None
    if mode == "narrative_only":
        warning = (
            f"Data completeness score is {score}/100. "
            "Only narrative commentary is available. "
            "Precise predictions and probabilities are disabled."
        )
    elif mode == "warning":
        warning = (
            f"Data completeness score is {score}/100. "
            "Prediction confidence has been capped and some outputs are disabled."
        )

    # ── Feature flags ────────────────────────────────────────────────────

    # Missing lineup -> no player adjustment
    flags["playerRatingAdjustment"] = has_lineups
    # Missing playerStats -> scorer ranking only / low confidence
    flags["scorerRanking"] = has_player_stats
    flags["scorerRankingBasic"] = has_lineups and not has_player_stats
    # Missing card stats -> risk level only
    flags["cardRiskAssessment"] = has_card_stats
    flags["cardRiskLevelOnly"] = has_lineups and not has_card_stats
    # Missing referee -> league average + degraded
    flags["refereeAdjustment"] = has_referee
    flags["refereeLeagueAverage"] = not has_referee
    # Missing recent form -> no exact probability
    flags["noExactProbability"] = not has_recent_form
    # Narrative-only mode flag
    flags["narrativeOnly"] = mode == "narrative_only"
    # No prediction flag (false when fixture exists)
    flags["noPrediction"] = False

    return DataCompletenessResult(
        score=score,
        mode=mode,
        availableCategories=available,
        missingCategories=missing,
        degradedReasons=reasons,
        warning=warning,
        confidenceCap=confidence_cap,
        flags=flags,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _record(
    category: str,
    present: bool,
    available: list[str],
    missing: list[str],
    reasons: list[str],
) -> None:
    if present:
        available.append(category)
    else:
        missing.append(category)
        reasons.append(f"Missing {category}")


def _cap_for_score(score: int) -> float:
    for threshold, cap in _CAPS_BY_SCORE:
        if score >= threshold:
            return cap
    return 0.50


def _has_lineups(data: dict) -> bool:
    lineups = data.get("lineups")
    if not lineups:
        return False
    home = lineups.get("home") if isinstance(lineups, dict) else None
    away = lineups.get("away") if isinstance(lineups, dict) else None
    return bool(home and away)


def _has_player_stats(data: dict) -> bool:
    # Check for explicit player stats field
    if data.get("playerStats"):
        return True
    # Check if players in lineups have stats
    lineups = data.get("lineups")
    if lineups and isinstance(lineups, dict):
        for side in ("home", "away"):
            side_data = lineups.get(side, {})
            players = side_data.get("players", []) if isinstance(side_data, dict) else []
            if players:
                for p in players:
                    if isinstance(p, dict) and ("xGLast5" in p or "recentRating" in p or "xg" in p):
                        return True
    # If lineups key exists (even if None), playerStats could come from other sources
    # Only mark as missing if there's no lineups key at all
    return "lineups" in data


def _has_card_stats(data: dict) -> bool:
    # Check for explicit card stats field
    if data.get("cardStats") or data.get("cards"):
        return True
    # Check if players in lineups have card data
    lineups = data.get("lineups")
    if lineups and isinstance(lineups, dict):
        for side in ("home", "away"):
            side_data = lineups.get(side, {})
            players = side_data.get("players", []) if isinstance(side_data, dict) else []
            for p in players:
                if isinstance(p, dict) and ("foulsPer90" in p or "yellowCardsLast10" in p):
                    return True
    # If lineups key exists (even if None), cardStats could come from other sources
    return "lineups" in data


def _has_referee(data: dict) -> bool:
    ref = data.get("referee")
    if not ref or not isinstance(ref, dict):
        return False
    return bool(ref.get("name"))


def _has_match_context(data: dict) -> bool:
    return bool(data.get("homeTeam") and data.get("awayTeam"))


def _has_fixture(data: dict) -> bool:
    """Check if the match fixture data is present (matchId + kickoff + teams)."""
    has_match_id = bool(data.get("matchId"))
    has_kickoff = bool(data.get("kickoff"))
    has_teams = bool(data.get("homeTeam") and data.get("awayTeam"))
    return has_match_id and has_kickoff and has_teams


def _has_recent_form(data: dict) -> bool:
    """Check if recent form data is available for either team."""
    # Check explicit recentForm field
    form = data.get("recentForm")
    if form and isinstance(form, (list, dict)):
        return True
    # Check homeTeam/awayTeam for form data
    for side in ("homeTeam", "awayTeam"):
        team = data.get(side, {})
        if isinstance(team, dict):
            if team.get("form") or team.get("recentForm") or team.get("last5"):
                return True
    return False


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------


def apply_confidence_cap(confidence: float, cap: float) -> float:
    """Cap a confidence value to the given maximum."""
    return min(confidence, cap)


def get_league_average_referee() -> dict:
    """Return league-average referee statistics as a fallback."""
    return {
        "name": "League Average",
        "cardsPerMatch": 3.8,
        "foulsPerMatch": 22.0,
        "penaltiesPerMatch": 0.25,
        "isLeagueAverage": True,
    }


# ---------------------------------------------------------------------------
# Backward-compatible aliases (for test_data_completeness.py)
# ---------------------------------------------------------------------------


@dataclass
class DataCompletenessInput:
    """Flags indicating which data sources are available for a match."""
    has_lineup: bool = False
    has_player_stats: bool = False
    has_card_stats: bool = False
    has_referee: bool = False
    has_recent_form: bool = False
    has_h2h: bool = False
    has_injuries: bool = False
    has_xg: bool = False
    missing_fields: list[str] = field(default_factory=list)


@dataclass
class AllowedOutputs:
    """Flags indicating which prediction outputs are safe to display."""
    precise_probabilities: bool
    scorer_ranking: bool
    card_risk_level: bool
    player_rating_adjustment: bool
    referee_impact: bool


def compute_data_completeness(input_data: DataCompletenessInput) -> DataCompletenessResult:
    """Backward-compatible wrapper around assess_data_completeness."""
    match_data: dict = {
        "matchId": "compat",
        "kickoff": "2026-01-01T00:00:00Z",
        "lineups": {"home": {}, "away": {}} if input_data.has_lineup else None,
        "referee": {"name": "dummy"} if input_data.has_referee else None,
        "homeTeam": {"name": "A"} if True else None,
        "awayTeam": {"name": "B"} if True else None,
    }
    if input_data.has_recent_form:
        match_data["recentForm"] = [{"result": "W"}]
    result = assess_data_completeness(match_data)

    # Remap to backward-compatible structure
    return DataCompletenessResult(
        score=result.score,
        mode=result.mode,
        availableCategories=result.availableCategories,
        missingCategories=[f for f in [
            "lineup" if not input_data.has_lineup else None,
            "playerStats" if not input_data.has_player_stats else None,
            "cardStats" if not input_data.has_card_stats else None,
            "referee" if not input_data.has_referee else None,
            "recentForm" if not input_data.has_recent_form else None,
            "h2h" if not input_data.has_h2h else None,
            "injuries" if not input_data.has_injuries else None,
            "xg" if not input_data.has_xg else None,
        ] if f is not None],
        degradedReasons=result.degradedReasons,
        warning=result.warning,
        confidenceCap=result.confidenceCap,
        flags=result.flags,
    )


def full_data_input(missing_fields: list[str] | None = None) -> DataCompletenessInput:
    """Build an input with all data present."""
    return DataCompletenessInput(
        has_lineup=True, has_player_stats=True, has_card_stats=True,
        has_referee=True, has_recent_form=True, has_h2h=True,
        has_injuries=True, has_xg=True,
        missing_fields=missing_fields or [],
    )


def empty_data_input(missing_fields: list[str] | None = None) -> DataCompletenessInput:
    """Build an input with no data present."""
    return DataCompletenessInput(
        has_lineup=False, has_player_stats=False, has_card_stats=False,
        has_referee=False, has_recent_form=False, has_h2h=False,
        has_injuries=False, has_xg=False,
        missing_fields=missing_fields or [],
    )
