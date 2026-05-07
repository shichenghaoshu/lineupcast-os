"""Deterministic service layer backed by persistent SQLite storage."""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from fastapi import HTTPException

from src.mock_data import LINEUPS, MATCH_DEMO, PLAYERS_DB, PREDICTION, PROVIDERS, TEAMS

from .config import Settings
from .db import get_db
from .schemas import (
    BacktestResponse,
    CardRisk,
    GoalScorer,
    LineupRefreshResponse,
    MatchImportRequest,
    MatchLineups,
    MatchSnapshot,
    MatchSummary,
    ModelBacktestRequest,
    ModelCard,
    ModelCardCalibrationBin,
    ModelCardDataSnapshot,
    ModelCardFailureSegment,
    ModelCardMetrics,
    ModelComparisonItem,
    ModelComparisonResponse,
    ModelEvaluation,
    ModelInfo,
    ModelReference,
    PredictionModelInfo,
    OverlayLayout,
    OverlayZone,
    Player,
    PredictionExplainResponse,
    PredictionResponse,
    ProviderLog,
    ProviderSyncResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ReadinessComponent,
    ReadinessProvider,
    ReadinessResponse,
    ScriptGenerateRequest,
    ScriptLanguage,
    ScriptResponse,
    ScriptTranslateRequest,
    SnapshotSaveRequest,
    TeamDetail,
)
from .storage import storage

from .script_bridge import call_script_generator
from .prediction_bridge import call_prediction_engine

import json as _json
import logging as _logging
import subprocess as _subprocess
from pathlib import Path as _Path

_model_card_logger = _logging.getLogger(__name__)
_MODEL_CARD_SCRIPT = _Path(__file__).parent.parent / "scripts" / "model-card.mjs"


def call_model_card_generator(params: dict) -> dict | None:
    """Call the TypeScript model card generator via subprocess.

    Returns the model card dict (with json + markdown) on success, None on failure.
    """
    if not _MODEL_CARD_SCRIPT.exists():
        _model_card_logger.warning("Model card bridge script not found: %s", _MODEL_CARD_SCRIPT)
        return None
    try:
        result = _subprocess.run(
            ["node", str(_MODEL_CARD_SCRIPT)],
            input=_json.dumps(params),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            _model_card_logger.warning("Model card bridge failed: %s", result.stderr)
            return None
        return _json.loads(result.stdout)
    except (_subprocess.TimeoutExpired, _json.JSONDecodeError, FileNotFoundError) as exc:
        _model_card_logger.warning("Model card bridge error: %s", exc)
        return None


# ── Model definitions for model card generation ─────────────────────────────

_MODEL_DEFINITIONS: dict[str, dict] = {
    "dixon-coles-poisson": {
        "name": "Dixon-Coles Time-Weighted Poisson",
        "version": "2.0.0",
        "type": "Correlated Poisson model with time-weighted strength parameters",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": [
            "Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market.",
        ],
        "intendedUse": [
            "Pre-match home/draw/away probability estimation",
            "Scoreline probability matrix generation",
            "Commentary preparation and data journalism",
        ],
        "notIntendedFor": [
            "Gambling advice or live trading",
            "High-stakes decisions without human review",
        ],
        "inputFeatures": [
            {"name": "homeTeam.attack", "description": "Relative attacking strength (1.0 = avg)"},
            {"name": "homeTeam.defence", "description": "Relative defensive strength (lower = better)"},
            {"name": "awayTeam.attack", "description": "Relative attacking strength"},
            {"name": "awayTeam.defence", "description": "Relative defensive strength"},
            {"name": "homeAdvantage", "description": "HFA multiplier on home expected goals", "defaultValue": 1.35},
            {"name": "rho", "description": "Low-score correlation correction", "defaultValue": -0.13},
            {"name": "leagueAvgGoals", "description": "League average goals per team per match", "defaultValue": 1.35},
            {"name": "maxGoals", "description": "Score matrix upper bound", "defaultValue": 10},
        ],
        "outputs": [
            "expectedHomeGoals, expectedAwayGoals",
            "scoreMatrix \u2014 probability for each (home, away) scoreline",
            "homeWin, draw, awayWin \u2014 outcome probabilities",
            "confidence \u2014 low / medium / high",
        ],
        "limitations": [
            "Assumes independent Poisson distributions (with rho correction)",
            "Strength parameters require sufficient historical data",
            "Does not account for red cards, injuries, or tactical changes",
            "Time decay may over-weight small recent samples",
        ],
        "caveats": [
            "Performance degrades for newly promoted teams with limited history",
            "Home advantage parameter is league-level, not team-specific",
        ],
    },
    "player-rating-adjustment": {
        "name": "Player Rating Adjustment",
        "version": "1.0.0",
        "type": "Contextual delta adjustment on baseline rating",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": ["Daley, D. & Matthews, J. (2022) Contextual Player Valuation in Football"],
        "intendedUse": ["Adjusting a baseline player rating for a specific match context"],
        "notIntendedFor": ["Precise performance prediction", "Transfer valuation"],
        "inputFeatures": [
            {"name": "baselineRating", "description": "Season-long rating 0-100"},
            {"name": "recentForm", "description": "Last 5 match avg rating"},
            {"name": "minutesLast30Days", "description": "Fitness proxy"},
            {"name": "age", "description": "Player age"},
            {"name": "isHome", "description": "Venue"},
            {"name": "opponentStrength", "description": "0-1"},
        ],
        "outputs": ["adjustedRating", "adjustment", "confidence"],
        "limitations": [
            "Baseline rating quality depends on source",
            "Age curve is population-level, not individual",
            "Form over 5 matches has high variance",
            "Does not capture tactical fit or role changes",
        ],
        "caveats": [],
    },
    "xg-share": {
        "name": "xG Share Goal Scorer Prediction",
        "version": "1.0.0",
        "type": "Weighted composite scorer using xG-derived features",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": ["StatBomb xG open-source framework (2018+)"],
        "intendedUse": ["Per-player goal probability estimation for a specific match"],
        "notIntendedFor": ["Gambling advice", "Precise probability claims"],
        "inputFeatures": [
            {"name": "starterMinutes", "description": "Expected minutes (0-90)"},
            {"name": "position", "description": "GK / DEF / MID / FWD"},
            {"name": "recentXG", "description": "xG over last 5 matches"},
            {"name": "shotsPer90", "description": "Shots per 90 minutes"},
            {"name": "isPenaltyTaker", "description": "Boolean"},
        ],
        "outputs": ["playerExpectedGoals", "P(goal)"],
        "limitations": [
            "xG is a model itself \u2014 inherits xG estimation uncertainty",
            "Does not account for specific match-up dynamics",
            "Penalty taker status may change during a match",
        ],
        "caveats": [],
    },
    "expected-booking-xb": {
        "name": "Expected Booking xB-Inspired Card Risk",
        "version": "1.0.0",
        "type": "Weighted composite booking risk model",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": ["Mariscal, G. et al. (2024) Expected Booking"],
        "intendedUse": ["Pre-match yellow card risk assessment per player"],
        "notIntendedFor": ["Precise card probability claims", "Gambling"],
        "inputFeatures": [
            {"name": "yellowCardsPer90", "description": "Historical yellows per 90"},
            {"name": "foulsPer90", "description": "Fouls committed per 90"},
            {"name": "position", "description": "DEF highest risk, GK lowest"},
        ],
        "outputs": ["yellowCardProbability", "redCardRisk", "riskScore"],
        "limitations": [
            "Yellow card probability is a proxy, not direct measurement",
            "Referee assignment may not be known at prediction time",
            "Red card output is deliberately categorical only",
        ],
        "caveats": [],
    },
    "simple-red-card-risk": {
        "name": "Simple Red Card Risk (Categorical)",
        "version": "1.0.0",
        "type": "Categorical risk classification",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": ["Mariscal, G. et al. (2024) Expected Booking"],
        "intendedUse": ["Pre-match red card risk tier assessment"],
        "notIntendedFor": ["Precise red card probability claims", "Gambling"],
        "inputFeatures": [{"name": "compositeRiskScore", "description": "Composite risk score 0-1"}],
        "outputs": ["redCardRisk \u2014 categorical: low / medium / high"],
        "limitations": [
            "Thresholds are heuristic, not empirically optimised",
            "Does not distinguish between second-yellow and straight-red risk",
            "Very few training examples for high category",
        ],
        "caveats": [],
    },
    "lineupcast-scriptwriter": {
        "name": "LineupCast Scriptwriter",
        "version": "1.0.0",
        "type": "Deterministic template-based script generator",
        "owner": "LineupCast OS community",
        "license": "MIT",
        "references": [],
        "intendedUse": ["Pre-match broadcast script generation"],
        "notIntendedFor": ["Live commentary", "Automated publishing without human review"],
        "inputFeatures": [
            {"name": "prediction", "description": "Match prediction data"},
            {"name": "goalScorers", "description": "Top goal scorer candidates"},
            {"name": "language", "description": "Output language (en/zh/bilingual)"},
        ],
        "outputs": ["script", "title"],
        "limitations": ["Template-based, not conversational", "Limited to pre-match context"],
        "caveats": [],
    },
}

# Deterministic mock historical predictions for model card evaluation
_MOCK_HISTORICAL_PREDICTIONS: list[dict] = [
    {"homeWin": 55, "draw": 25, "awayWin": 20, "actualOutcome": "homeWin", "expectedHomeGoals": 1.8, "expectedAwayGoals": 1.0},
    {"homeWin": 40, "draw": 30, "awayWin": 30, "actualOutcome": "draw", "expectedHomeGoals": 1.3, "expectedAwayGoals": 1.3},
    {"homeWin": 60, "draw": 22, "awayWin": 18, "actualOutcome": "homeWin", "expectedHomeGoals": 2.0, "expectedAwayGoals": 0.9},
    {"homeWin": 35, "draw": 28, "awayWin": 37, "actualOutcome": "awayWin", "expectedHomeGoals": 1.1, "expectedAwayGoals": 1.5},
    {"homeWin": 48, "draw": 27, "awayWin": 25, "actualOutcome": "draw", "expectedHomeGoals": 1.6, "expectedAwayGoals": 1.2},
    {"homeWin": 70, "draw": 18, "awayWin": 12, "actualOutcome": "homeWin", "expectedHomeGoals": 2.3, "expectedAwayGoals": 0.7},
    {"homeWin": 25, "draw": 30, "awayWin": 45, "actualOutcome": "awayWin", "expectedHomeGoals": 0.9, "expectedAwayGoals": 1.7},
    {"homeWin": 50, "draw": 26, "awayWin": 24, "actualOutcome": "homeWin", "expectedHomeGoals": 1.5, "expectedAwayGoals": 1.1},
    {"homeWin": 42, "draw": 29, "awayWin": 29, "actualOutcome": "draw", "expectedHomeGoals": 1.4, "expectedAwayGoals": 1.4},
    {"homeWin": 58, "draw": 23, "awayWin": 19, "actualOutcome": "awayWin", "expectedHomeGoals": 1.9, "expectedAwayGoals": 1.0},
    {"homeWin": 33, "draw": 32, "awayWin": 35, "actualOutcome": "draw", "expectedHomeGoals": 1.2, "expectedAwayGoals": 1.3},
    {"homeWin": 65, "draw": 20, "awayWin": 15, "actualOutcome": "homeWin", "expectedHomeGoals": 2.1, "expectedAwayGoals": 0.8},
    {"homeWin": 45, "draw": 28, "awayWin": 27, "actualOutcome": "homeWin", "expectedHomeGoals": 1.5, "expectedAwayGoals": 1.2},
    {"homeWin": 20, "draw": 25, "awayWin": 55, "actualOutcome": "awayWin", "expectedHomeGoals": 0.8, "expectedAwayGoals": 1.9},
    {"homeWin": 52, "draw": 25, "awayWin": 23, "actualOutcome": "homeWin", "expectedHomeGoals": 1.7, "expectedAwayGoals": 1.1},
    {"homeWin": 38, "draw": 30, "awayWin": 32, "actualOutcome": "draw", "expectedHomeGoals": 1.3, "expectedAwayGoals": 1.3},
    {"homeWin": 72, "draw": 17, "awayWin": 11, "actualOutcome": "homeWin", "expectedHomeGoals": 2.5, "expectedAwayGoals": 0.6},
    {"homeWin": 28, "draw": 27, "awayWin": 45, "actualOutcome": "awayWin", "expectedHomeGoals": 1.0, "expectedAwayGoals": 1.6},
    {"homeWin": 55, "draw": 24, "awayWin": 21, "actualOutcome": "homeWin", "expectedHomeGoals": 1.8, "expectedAwayGoals": 1.0},
    {"homeWin": 41, "draw": 29, "awayWin": 30, "actualOutcome": "awayWin", "expectedHomeGoals": 1.3, "expectedAwayGoals": 1.4},
    {"homeWin": 62, "draw": 21, "awayWin": 17, "actualOutcome": "homeWin", "expectedHomeGoals": 2.0, "expectedAwayGoals": 0.9},
    {"homeWin": 30, "draw": 33, "awayWin": 37, "actualOutcome": "draw", "expectedHomeGoals": 1.1, "expectedAwayGoals": 1.4},
    {"homeWin": 48, "draw": 27, "awayWin": 25, "actualOutcome": "homeWin", "expectedHomeGoals": 1.6, "expectedAwayGoals": 1.2},
    {"homeWin": 36, "draw": 28, "awayWin": 36, "actualOutcome": "awayWin", "expectedHomeGoals": 1.2, "expectedAwayGoals": 1.4},
    {"homeWin": 57, "draw": 24, "awayWin": 19, "actualOutcome": "homeWin", "expectedHomeGoals": 1.8, "expectedAwayGoals": 1.0},
    {"homeWin": 43, "draw": 28, "awayWin": 29, "actualOutcome": "draw", "expectedHomeGoals": 1.4, "expectedAwayGoals": 1.3},
    {"homeWin": 68, "draw": 19, "awayWin": 13, "actualOutcome": "homeWin", "expectedHomeGoals": 2.2, "expectedAwayGoals": 0.7},
    {"homeWin": 22, "draw": 26, "awayWin": 52, "actualOutcome": "awayWin", "expectedHomeGoals": 0.8, "expectedAwayGoals": 1.8},
    {"homeWin": 50, "draw": 26, "awayWin": 24, "actualOutcome": "draw", "expectedHomeGoals": 1.5, "expectedAwayGoals": 1.2},
    {"homeWin": 46, "draw": 27, "awayWin": 27, "actualOutcome": "homeWin", "expectedHomeGoals": 1.5, "expectedAwayGoals": 1.2},
]


def _build_model_card_params(model_id: str) -> dict | None:
    """Build model card generator parameters for the given model id."""
    model_def = _MODEL_DEFINITIONS.get(model_id)
    if not model_def:
        return None
    return {
        "model": {
            "name": model_def["name"],
            "version": model_def["version"],
            "type": model_def["type"],
            "owner": model_def["owner"],
            "license": model_def["license"],
            "references": model_def["references"],
        },
        "intendedUse": model_def["intendedUse"],
        "notIntendedFor": model_def["notIntendedFor"],
        "inputFeatures": model_def["inputFeatures"],
        "outputs": model_def["outputs"],
        "predictions": _MOCK_HISTORICAL_PREDICTIONS,
        "dataSnapshot": {
            "provider": "mock-provider",
            "league": "Super Club Friendly",
            "season": "2025/26",
            "dateRangeStart": "2025-08-01",
            "dateRangeEnd": "2026-05-06",
            "matchCount": len(_MOCK_HISTORICAL_PREDICTIONS),
            "snapshotCreatedAt": "2026-05-06T00:00:00Z",
            "snapshotVersion": "mock-1.0.0",
        },
        "limitations": model_def["limitations"],
        "caveats": model_def.get("caveats", []),
    }


def _ensure_seed_data() -> None:
    """Load seed data into the database on first start if empty."""
    db = get_db()
    if not db.match_exists(MATCH_DEMO["matchId"]):
        db.upsert_match(MATCH_DEMO.copy())


def now_utc() -> datetime:
    return datetime.now(UTC)


def _not_found(resource: str, resource_id: str) -> None:
    raise HTTPException(status_code=404, detail=f"{resource} '{resource_id}' not found")


def _player_with_id(player_id: str, player: dict) -> Player:
    return Player(playerId=player_id, **player)


def list_matches() -> list[MatchSummary]:
    _ensure_seed_data()
    db = get_db()
    return [MatchSummary(**match) for match in db.list_matches()]


def get_match(match_id: str) -> MatchSummary:
    _ensure_seed_data()
    db = get_db()
    match = db.get_match(match_id)
    if not match:
        _not_found("Match", match_id)
    return MatchSummary(**match)


def import_match(payload: MatchImportRequest) -> MatchSummary:
    home = TEAMS.get(payload.homeTeamId)
    away = TEAMS.get(payload.awayTeamId)
    if not home:
        _not_found("Team", payload.homeTeamId)
    if not away:
        _not_found("Team", payload.awayTeamId)

    match_id = payload.matchId or f"{payload.homeTeamId}-vs-{payload.awayTeamId}"
    match = {
        "matchId": match_id,
        "competition": payload.competition,
        "kickoff": payload.kickoff,
        "status": "scheduled",
        "homeTeam": {
            "teamId": home["teamId"],
            "name": home["name"],
            "shortName": home["shortName"],
            "crest": home.get("crest"),
        },
        "awayTeam": {
            "teamId": away["teamId"],
            "name": away["name"],
            "shortName": away["shortName"],
            "crest": away.get("crest"),
        },
        "score": None,
    }
    db = get_db()
    db.upsert_match(match)
    return MatchSummary(**match)


def get_team(team_id: str) -> TeamDetail:
    team = TEAMS.get(team_id)
    if not team:
        _not_found("Team", team_id)
    return TeamDetail(**team)


def get_player(player_id: str) -> Player:
    player = PLAYERS_DB.get(player_id)
    if not player:
        _not_found("Player", player_id)
    return _player_with_id(player_id, player)


def get_lineups(match_id: str) -> MatchLineups:
    lineup = LINEUPS.get(match_id)
    if not lineup:
        _not_found("Lineups for match", match_id)
    return MatchLineups(**lineup)


def refresh_lineups(match_id: str) -> LineupRefreshResponse:
    get_lineups(match_id)
    return LineupRefreshResponse(
        matchId=match_id,
        status="refreshed",
        provider="mock-provider",
        refreshedAt=now_utc(),
    )


def get_match_players(match_id: str) -> list[Player]:
    lineup = get_lineups(match_id)
    players: list[Player] = []
    for stored_id, stored in PLAYERS_DB.items():
        if stored["teamId"] in {lineup.home.teamId, lineup.away.teamId}:
            players.append(_player_with_id(stored_id, stored))
    return players


def _references() -> list[ModelReference]:
    return [
        ModelReference(title=model["name"], url=model["reference"])
        for model in PREDICTION["models"]
    ]


def get_prediction(settings: Settings, match_id: str) -> PredictionResponse:
    if match_id != PREDICTION["matchId"]:
        _not_found("Prediction for match", match_id)

    # ── Try the real prediction bridge first ──────────────────────────────
    db = get_db()
    match = db.get_match(match_id)
    if match is not None and settings.provider_mode == "model":
        bridge_input = {
            "matchId": match_id,
            "homeTeam": match.get("homeTeam", {}),
            "awayTeam": match.get("awayTeam", {}),
            "matchStats": PREDICTION.get("inputFeatures", {}),
            "lineups": LINEUPS.get(match_id, {}),
        }
        bridge_result = call_prediction_engine(bridge_input)
        if bridge_result is not None:
            prediction = PredictionResponse(
                matchId=match_id,
                homeWin=bridge_result.get("homeWin", PREDICTION["homeWin"]),
                draw=bridge_result.get("draw", PREDICTION["draw"]),
                awayWin=bridge_result.get("awayWin", PREDICTION["awayWin"]),
                expectedHomeGoals=bridge_result.get("expectedHomeGoals", PREDICTION["expectedHomeGoals"]),
                expectedAwayGoals=bridge_result.get("expectedAwayGoals", PREDICTION["expectedAwayGoals"]),
                modelName=bridge_result.get("modelName", settings.prediction_model_name),
                modelVersion=bridge_result.get("modelVersion", settings.prediction_model_version),
                confidence=bridge_result.get("confidence", PREDICTION["confidence"]),
                explanation=bridge_result.get("explanation", " ".join(PREDICTION["explanations"])),
                references=_references(),
                goalScorers=[
                    GoalScorer(**gs) for gs in bridge_result.get("goalScorers", PREDICTION["goalScorers"])
                ],
                cardRisks=[
                    CardRisk(
                        player=cr.get("player", ""),
                        team=cr.get("team", ""),
                        yellowRisk=cr.get("yellowRisk", 0),
                        redRisk=cr.get("redRisk", cr.get("redCardRisk", 0)),
                        redCardRisk=cr.get("redCardRisk", cr.get("redRisk", 0)),
                    )
                    for cr in bridge_result.get("cardRisks", PREDICTION["cardRisks"])
                ],
                generatedAt=now_utc(),
                inputFeatures=bridge_result.get("inputFeatures", PREDICTION["inputFeatures"]),
                models=[PredictionModelInfo(**m) for m in bridge_result.get("models", PREDICTION["models"])],
                explanations=bridge_result.get("explanations", PREDICTION["explanations"]),
            )
            db.save_prediction(prediction.model_dump(mode="json"))
            return prediction

    # ── Fallback to mock data ─────────────────────────────────────────────
    prediction = PredictionResponse(
        matchId=match_id,
        homeWin=PREDICTION["homeWin"],
        draw=PREDICTION["draw"],
        awayWin=PREDICTION["awayWin"],
        expectedHomeGoals=PREDICTION["expectedHomeGoals"],
        expectedAwayGoals=PREDICTION["expectedAwayGoals"],
        modelName=settings.prediction_model_name,
        modelVersion=settings.prediction_model_version,
        confidence=PREDICTION["confidence"],
        explanation=" ".join(PREDICTION["explanations"]),
        references=_references(),
        goalScorers=[GoalScorer(**item) for item in PREDICTION["goalScorers"]],
        cardRisks=[
            CardRisk(
                player=item["player"],
                team=item["team"],
                yellowRisk=item["yellowRisk"],
                redRisk=item["redRisk"],
                redCardRisk=item["redRisk"],
            )
            for item in PREDICTION["cardRisks"]
        ],
        generatedAt=now_utc(),
        inputFeatures=PREDICTION["inputFeatures"],
        models=[PredictionModelInfo(**item) for item in PREDICTION["models"]],
        explanations=PREDICTION["explanations"],
    )
    db.save_prediction(prediction.model_dump(mode="json"))
    return prediction


def explain_prediction(settings: Settings, match_id: str) -> PredictionExplainResponse:
    prediction = get_prediction(settings, match_id)
    return PredictionExplainResponse(
        matchId=match_id,
        modelName=prediction.modelName,
        modelVersion=prediction.modelVersion,
        factors=PREDICTION["explanations"],
        references=prediction.references,
    )


def backtest_prediction(match_id: str) -> BacktestResponse:
    get_match(match_id)
    return BacktestResponse(
        matchId=match_id,
        sampleSize=240,
        accuracy=0.68,
        brierScore=0.19,
        calibration="well-calibrated on mock friendly fixtures",
    )


def _script_body(language: ScriptLanguage, prediction: PredictionResponse) -> tuple[str, str]:
    line_en = (
        f"{prediction.modelName} gives the home side a {prediction.homeWin}% win "
        f"chance, with projected xG {prediction.expectedHomeGoals:.1f} to "
        f"{prediction.expectedAwayGoals:.1f}. Watch {prediction.goalScorers[0].player} "
        "as the leading scorer candidate."
    )
    line_zh = (
        f"根据 Dixon-Coles 与阵容修正模型，模型认为主队胜率为 {prediction.homeWin}%，预计 xG 为 "
        f"{prediction.expectedHomeGoals:.1f} 比 {prediction.expectedAwayGoals:.1f}。"
        f"概率上更值得关注 {prediction.goalScorers[0].player} 的进球威胁。"
    )
    if language == ScriptLanguage.zh:
        return "赛前预测口播", line_zh
    if language == ScriptLanguage.bilingual:
        return "Pre-match briefing / 赛前预测口播", f"{line_en}\n\n{line_zh}"
    return "Pre-match briefing", line_en


_VALID_STYLES = {"professional", "short-video", "passionate", "neutral", "broadcast"}
_VALID_DURATIONS = {"15s", "30s", "1min", "3min"}


def _map_confidence(confidence: float | str) -> str:
    """Map a numeric confidence (0-1) to the TS ``confidence`` enum string."""
    if isinstance(confidence, str):
        return confidence if confidence in ("low", "medium", "high") else "medium"
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.5:
        return "medium"
    return "low"


def _map_red_risk(risk: str) -> float:
    """Convert a string red-card risk level to a numeric probability."""
    return {"low": 0.05, "medium": 0.15, "high": 0.30}.get(risk, 0.05)


def _build_script_input(
    match_id: str,
    match: dict,
    raw_prediction: dict,
    payload: ScriptGenerateRequest,
) -> dict | None:
    """Build a ``ScriptGenerationInput`` dict for the TS package.

    Returns ``None`` when required data (e.g. lineups) is unavailable.
    """
    lineup = LINEUPS.get(match_id)
    if not lineup:
        return None

    home_team = match.get("homeTeam", {})
    away_team = match.get("awayTeam", {})
    competition = match.get("competition", "")
    requested_style = payload.style or payload.tone
    style = requested_style if requested_style in _VALID_STYLES else "broadcast"
    duration = payload.duration if payload.duration in _VALID_DURATIONS else "30s"
    language = (
        payload.language.value
        if hasattr(payload.language, "value")
        else str(payload.language)
    )

    return {
        "match": {
            "id": match_id,
            "homeTeamId": home_team.get("teamId", ""),
            "awayTeamId": away_team.get("teamId", ""),
            "homeTeam": {
                "id": home_team.get("teamId", ""),
                "name": home_team.get("name", ""),
                "shortName": home_team.get("shortName", ""),
                "league": competition,
            },
            "awayTeam": {
                "id": away_team.get("teamId", ""),
                "name": away_team.get("name", ""),
                "shortName": away_team.get("shortName", ""),
                "league": competition,
            },
            "kickoff": match.get("kickoff", ""),
            "league": competition,
            "status": match.get("status", "scheduled"),
        },
        "lineups": lineup,
        "prediction": {
            "matchId": raw_prediction.get("matchId", match_id),
            "homeWin": raw_prediction.get("homeWin", 50) / 100,
            "draw": raw_prediction.get("draw", 25) / 100,
            "awayWin": raw_prediction.get("awayWin", 25) / 100,
            "expectedHomeGoals": raw_prediction.get("expectedHomeGoals", 1.5),
            "expectedAwayGoals": raw_prediction.get("expectedAwayGoals", 1.0),
            "confidence": _map_confidence(raw_prediction.get("confidence", 0.5)),
        },
        "goalScorers": [
            {
                "player": gs.get("player", ""),
                "team": gs.get("team", ""),
                "probability": gs.get("probability", 0),
            }
            for gs in raw_prediction.get("goalScorers", [])
        ],
        "cardRisks": [
            {
                "player": cr.get("player", ""),
                "team": cr.get("team", ""),
                "yellowRisk": cr.get("yellowRisk", 0),
                "redRisk": _map_red_risk(cr.get("redRisk", "low")),
            }
            for cr in raw_prediction.get("cardRisks", [])
        ],
        "style": style,
        "duration": duration,
        "language": language,
    }


def _bridge_title(language: ScriptLanguage) -> str:
    """Generate a human-readable title for bridge-generated scripts."""
    if language == ScriptLanguage.zh:
        return "赛前预测口播"
    if language == ScriptLanguage.bilingual:
        return "Pre-match briefing / 赛前预测口播"
    return "Pre-match briefing"


def generate_script(
    settings: Settings, match_id: str, payload: ScriptGenerateRequest
) -> ScriptResponse:
    started = perf_counter()
    prediction = get_prediction(settings, match_id)

    # ── Try the real ai-script bridge first ──────────────────────────────
    db = get_db()
    match = db.get_match(match_id)
    if match is not None:
        script_input = _build_script_input(
            match_id, match, prediction.model_dump(mode="json"), payload
        )
        if script_input is not None:
            bridge_result = call_script_generator(script_input)
            if bridge_result is not None:
                latency_ms = max(1, int((perf_counter() - started) * 1000))
                teleprompter = bridge_result.get("teleprompterText", "")
                script_response = ScriptResponse(
                    scriptId=f"script_{uuid4().hex[:12]}",
                    matchId=match_id,
                    language=payload.language,
                    title=_bridge_title(payload.language),
                    script=teleprompter,
                    provider="lineupcast-ai-script",
                    model=(
                        f"{settings.script_model_name}"
                        f"@{settings.script_model_version}"
                    ),
                    latencyMs=latency_ms,
                    fallback=False,
                    status="generated",
                    generatedAt=now_utc(),
                    disclaimer=(
                        "DISCLAIMER: Generated from deterministic mock "
                        "demonstration data. Not for betting, scouting, "
                        "or professional match operations."
                    ),
                )
                db.save_script(script_response.model_dump(mode="json"))
                return script_response

    # ── Fallback to deterministic template ───────────────────────────────
    title, script = _script_body(payload.language, prediction)
    latency_ms = max(1, int((perf_counter() - started) * 1000))
    script_response = ScriptResponse(
        scriptId=f"script_{uuid4().hex[:12]}",
        matchId=match_id,
        language=payload.language,
        title=title,
        script=script,
        provider="mock-script-provider",
        model=f"{settings.script_model_name}@{settings.script_model_version}",
        latencyMs=latency_ms,
        fallback=settings.provider_mode == "mock",
        status="generated",
        generatedAt=now_utc(),
        disclaimer=(
            "DISCLAIMER: Generated from deterministic mock demonstration data. "
            "Not for betting, scouting, or professional match operations."
        ),
    )
    db.save_script(script_response.model_dump(mode="json"))
    return script_response


def list_scripts(match_id: str) -> list[ScriptResponse]:
    get_match(match_id)
    db = get_db()
    return [
        ScriptResponse(**script) for script in db.list_scripts(match_id)
    ]


def translate_script(
    settings: Settings, script_id: str, payload: ScriptTranslateRequest
) -> ScriptResponse:
    db = get_db()
    script_data = db.get_script(script_id)
    if not script_data:
        _not_found("Script", script_id)
    translated = generate_script(
        settings,
        script_data["matchId"],
        ScriptGenerateRequest(language=payload.language, tone="translated"),
    )
    return translated.model_copy(update={"scriptId": script_id, "status": "translated"})


def list_models(settings: Settings) -> list[ModelInfo]:
    return [
        ModelInfo(
            modelId="dixon-coles-poisson",
            name="Dixon-Coles Time-Weighted Poisson",
            version="1.0.0",
            provider="local-deterministic",
            task="match-outcome",
            status="ready",
        ),
        ModelInfo(
            modelId="player-rating-adjustment",
            name="Player Rating Adjustment",
            version="1.0.0",
            provider="local-deterministic",
            task="lineup-adjustment",
            status="ready",
        ),
        ModelInfo(
            modelId="xg-share",
            name="xG Share Model",
            version="1.0.0",
            provider="local-deterministic",
            task="goal-scorer-ranking",
            status="ready",
        ),
        ModelInfo(
            modelId="expected-booking-xb",
            name="Expected Booking xB-inspired Model",
            version="1.0.0",
            provider="local-deterministic",
            task="yellow-card-risk",
            status="ready",
        ),
        ModelInfo(
            modelId="simple-red-card-risk",
            name="Simple Red Card Risk",
            version="1.0.0",
            provider="local-deterministic",
            task="categorical-red-card-risk",
            status="ready",
        ),
        ModelInfo(
            modelId="lineupcast-scriptwriter",
            name=settings.script_model_name,
            version=settings.script_model_version,
            provider="local-deterministic",
            task="script-generation",
            status="ready",
        ),
    ]


def get_model(settings: Settings, model_id: str) -> ModelInfo:
    for model in list_models(settings):
        if model.modelId == model_id:
            return model
    _not_found("Model", model_id)


def get_model_card(settings: Settings, model_id: str) -> ModelCard:
    """Generate a model card with real metrics from the TypeScript model card generator.

    Falls back to a basic card if the bridge is unavailable.
    """
    model = get_model(settings, model_id)
    params = _build_model_card_params(model_id)

    if params is not None:
        bridge_result = call_model_card_generator(params)
        if bridge_result is not None:
            card_json = bridge_result.get("json", {})
            card_metrics = card_json.get("metrics", {})
            card_snapshot = card_json.get("dataSnapshot", {})
            return ModelCard(
                modelId=model.modelId,
                name=model.name,
                intendedUse="\n".join(card_json.get("intendedUse", [])),
                limitations=card_json.get("limitations", []),
                features=[f.get("name", "") for f in card_json.get("inputFeatures", [])],
                version=card_json.get("model", {}).get("version"),
                modelType=card_json.get("model", {}).get("type"),
                references=card_json.get("model", {}).get("references", []),
                notIntendedFor=card_json.get("notIntendedFor", []),
                outputs=card_json.get("outputs", []),
                metrics=ModelCardMetrics(
                    sampleSize=card_metrics.get("sampleSize", 0),
                    brierScore=card_metrics.get("brierScore", 0.0),
                    brierScoreConfidence=card_metrics.get("brierScoreConfidence", "low"),
                    logLoss=card_metrics.get("logLoss", 0.0),
                    logLossConfidence=card_metrics.get("logLossConfidence", "low"),
                    ece=card_metrics.get("ece", 0.0),
                    eceConfidence=card_metrics.get("eceConfidence", "low"),
                ),
                calibrationBins=[
                    ModelCardCalibrationBin(**bin_data)
                    for bin_data in card_json.get("calibrationBins", [])
                ],
                failureSegments=[
                    ModelCardFailureSegment(**seg)
                    for seg in card_json.get("failureSegments", [])
                ],
                dataSnapshot=ModelCardDataSnapshot(**card_snapshot) if card_snapshot else None,
                caveats=card_json.get("caveats", []),
                generatedAt=datetime.fromisoformat(card_json["generatedAt"]) if card_json.get("generatedAt") else None,
                schemaVersion=card_json.get("schemaVersion", "1.0.0"),
            )

    # Fallback to basic card if bridge is unavailable
    return ModelCard(
        modelId=model.modelId,
        name=model.name,
        intendedUse="Pre-match demonstration predictions and commentary drafts.",
        limitations=[
            "Uses mock data in this deployable service.",
            "Not suitable for betting, professional scouting, or live match operations.",
        ],
        features=PREDICTION["inputFeatures"],
    )


def get_model_card_markdown(settings: Settings, model_id: str) -> str:
    """Generate and return the human-readable Markdown model card."""
    get_model(settings, model_id)
    params = _build_model_card_params(model_id)

    if params is not None:
        bridge_result = call_model_card_generator(params)
        if bridge_result is not None:
            return bridge_result.get("markdown", "# Model Card\n\nMarkdown generation failed.")

    return (
        "# Model Card\n\n"
        "Model card generation requires the TypeScript prediction package. "
        "Ensure `packages/prediction` is built (`npm run build`)."
    )


def get_model_evaluation(settings: Settings, model_id: str) -> ModelEvaluation:
    get_model(settings, model_id)
    return ModelEvaluation(
        modelId=model_id,
        sampleSize=240,
        accuracy=0.68,
        brierScore=0.19,
        lastEvaluatedAt=now_utc(),
    )


def compare_models(
    settings: Settings, model_ids_param: str, match_id: str | None = None
) -> ModelComparisonResponse:
    """Build a side-by-side comparison of multiple models.

    Each item includes the model's info, its model-card metrics, calibration
    bins, and evaluation data so the frontend can render comparison charts.
    """
    all_models = list_models(settings)

    # Parse requested model IDs (comma-separated); default to all models
    if model_ids_param.strip():
        requested = {mid.strip() for mid in model_ids_param.split(",") if mid.strip()}
        selected = [m for m in all_models if m.modelId in requested]
    else:
        selected = all_models

    items: list[ModelComparisonItem] = []
    for model in selected:
        # Fetch model card for metrics and calibration
        card = get_model_card(settings, model.modelId)
        evaluation = get_model_evaluation(settings, model.modelId)

        items.append(
            ModelComparisonItem(
                modelId=model.modelId,
                name=model.name,
                version=model.version,
                task=model.task,
                status=model.status,
                metrics=card.metrics,
                calibrationBins=card.calibrationBins,
                evaluation=evaluation,
            )
        )

    return ModelComparisonResponse(models=items, matchId=match_id)


def backtest_model(settings: Settings, payload: ModelBacktestRequest) -> BacktestResponse:
    get_model(settings, payload.modelId)
    return BacktestResponse(
        modelId=payload.modelId,
        sampleSize=240,
        accuracy=0.68,
        brierScore=0.19,
        calibration="mock backtest uses deterministic historical fixtures",
    )


def test_provider(payload: ProviderTestRequest) -> ProviderTestResponse:
    provider_ids = {provider["id"] for provider in PROVIDERS}
    if payload.providerId not in provider_ids:
        _not_found("Provider", payload.providerId)
    return ProviderTestResponse(
        providerId=payload.providerId,
        ok=True,
        latencyMs=8,
        detail="Provider mock check completed.",
    )


def sync_providers() -> ProviderSyncResponse:
    db = get_db()
    db.save_provider_run(
        provider_id="all-providers",
        status="synced",
        provider_count=len(PROVIDERS),
    )
    return ProviderSyncResponse(
        status="synced",
        providerCount=len(PROVIDERS),
        syncedAt=now_utc(),
    )


def save_prediction_record(
    match_id: str,
    prediction_data: dict,
    actual_result: dict | None = None,
    notes: str | None = None,
) -> dict:
    """Persist a prediction record for tracking prediction history."""
    db = get_db()
    return db.save_prediction_record(
        match_id=match_id,
        prediction_data=prediction_data,
        actual_result=actual_result,
        notes=notes,
    )


def save_provider_run(
    provider_id: str,
    status: str = "synced",
    provider_count: int = 0,
) -> dict:
    """Persist a provider sync run for tracking provider history."""
    db = get_db()
    return db.save_provider_run(
        provider_id=provider_id,
        status=status,
        provider_count=provider_count,
    )


def provider_logs() -> list[ProviderLog]:
    logs: list[ProviderLog] = [
        ProviderLog(
            providerId="mock-provider",
            level="info",
            message="Mock Provider ready with deterministic demo match data.",
            createdAt=now_utc(),
        ),
        ProviderLog(
            providerId="statsbomb-open-data",
            level="info",
            message="StatsBomb Open Data adapter placeholder loaded; no token required for mock mode.",
            createdAt=now_utc(),
        ),
    ]
    # Append error logs for providers that have recorded failures
    for provider in PROVIDERS:
        last_error = provider.get("lastError")
        if last_error:
            logs.append(
                ProviderLog(
                    providerId=provider["id"],
                    level="error",
                    message=last_error,
                    createdAt=now_utc(),
                )
            )
    return logs


def _compute_freshness(last_sync: str | None) -> str:
    """Compute a human-readable freshness label from a lastSuccessfulSync timestamp."""
    if not last_sync:
        return "never"
    try:
        sync_dt = datetime.fromisoformat(last_sync.replace("Z", "+00:00"))
        delta = now_utc() - sync_dt
        minutes = int(delta.total_seconds() / 60)
        if minutes < 5:
            return "just now"
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        days = hours // 24
        return f"{days}d ago"
    except (ValueError, TypeError):
        return "unknown"


def readiness(settings: Settings) -> ReadinessResponse:
    external_ready = settings.provider_mode != "external" or bool(settings.provider_api_key)
    if settings.provider_mode == "mock":
        provider_detail = "mock provider ready"
    elif settings.provider_mode == "model":
        provider_detail = "local TypeScript model bridge mode configured"
    elif external_ready:
        provider_detail = "external provider key configured"
    else:
        provider_detail = "external provider key missing"

    # Build per-provider readiness info with error details, freshness,
    # missing capabilities, and degraded reasons.
    readiness_providers: list[ReadinessProvider] = []
    freshness_map: dict[str, str] = {}
    total_error_count = 0
    has_provider_errors = False

    for provider in PROVIDERS:
        error_count = provider.get("errorCount", 0)
        health = provider.get("health", "healthy")
        provider_status = provider.get("status", "connected")
        total_error_count += error_count
        if health in ("degraded", "unhealthy"):
            has_provider_errors = True

        # Compute freshness label from lastSuccessfulSync
        last_sync = provider.get("lastSuccessfulSync")
        freshness = _compute_freshness(last_sync)
        freshness_map[provider["id"]] = freshness

        # Derive missing capabilities from provider status
        missing_capabilities: list[str] = []
        if provider_status in ("needs-token", "missing_token"):
            missing_capabilities = ["lineups", "playerStats", "fixtures"]
        elif provider_status == "placeholder":
            missing_capabilities = ["lineups", "playerStats"]
        elif provider_status == "rate_limited":
            missing_capabilities = []  # has capabilities, just rate-limited

        # Build degraded reasons from health and lastError
        degraded_reasons: list[str] = []
        if health in ("degraded", "unhealthy"):
            last_error = provider.get("lastError")
            if last_error:
                degraded_reasons.append(last_error)
            if provider_status == "needs-token":
                degraded_reasons.append("API token not configured")
            if provider_status == "rate_limited":
                degraded_reasons.append(f"Rate limited since {last_sync or 'unknown'}")

        readiness_providers.append(
            ReadinessProvider(
                id=provider["id"],
                name=provider["name"],
                status=provider_status,
                errorCount=error_count,
                lastError=provider.get("lastError"),
                lastSuccessfulSync=last_sync,
                freshness=freshness,
                health=health,  # type: ignore[arg-type]
                missingCapabilities=missing_capabilities,
                degradedReasons=degraded_reasons,
            )
        )

    # Determine overall status: degraded if any provider has errors
    overall_status = "degraded" if has_provider_errors or not external_ready else "ready"

    return ReadinessResponse(
        status=overall_status,
        provider=ReadinessComponent(
            available=external_ready,
            mode=settings.provider_mode,
            detail=provider_detail,
        ),
        model=ReadinessComponent(
            available=bool(settings.prediction_model_name),
            mode="deterministic",
            detail="model configured from environment",
        ),
        providers=readiness_providers,
        providerFreshness=freshness_map,
        errorCount=total_error_count,
    )


def overlay(match_id: str) -> OverlayLayout:
    get_match(match_id)
    return OverlayLayout(
        matchId=match_id,
        zones={
            "landscape_16x9": OverlayZone(
                type="image",
                width=1920,
                height=1080,
                description="16:9 pitch, lineups, team crests, and prediction bar.",
            ),
            "portrait_9x16": OverlayZone(
                type="image",
                width=1080,
                height=1920,
                description="9:16 stacked mobile story layout.",
            ),
            "lower_third": OverlayZone(
                type="overlay",
                width=1920,
                height=200,
                description="Lower-third team, formation, and prediction strip.",
            ),
            "prediction_strip": OverlayZone(
                type="overlay",
                width=1920,
                height=120,
                description="Horizontal win-probability and xG strip.",
            ),
        },
    )


# ---------------------------------------------------------------------------
# Snapshot persistence
# ---------------------------------------------------------------------------


def _snapshot_id(provider: str, league: str, season: str, match_id: str) -> str:
    """Build a deterministic snapshot identifier from its coordinates."""
    return f"{provider}_{league}_{season}_{match_id}"


def save_snapshot(payload: SnapshotSaveRequest) -> MatchSnapshot:
    """Persist a match snapshot to disk and return the resulting schema."""
    storage.save_snapshot(
        match_id=payload.matchId,
        provider=payload.provider,
        league=payload.league,
        season=payload.season,
        data={"dataVersion": payload.dataVersion, **payload.data},
    )
    return MatchSnapshot(
        snapshotId=_snapshot_id(
            payload.provider, payload.league, payload.season, payload.matchId
        ),
        matchId=payload.matchId,
        provider=payload.provider,
        league=payload.league,
        season=payload.season,
        dataVersion=payload.dataVersion,
        data=payload.data,
        savedAt=now_utc(),
    )


def load_snapshot(match_id: str, provider: str, league: str, season: str) -> MatchSnapshot:
    """Load a snapshot from disk by its coordinates.

    Raises ``HTTPException(404)`` if the snapshot file is missing.
    """
    try:
        raw = storage.load_snapshot(match_id, provider, league, season)
    except FileNotFoundError:
        _not_found("Snapshot", f"{provider}/{league}/{season}/{match_id}")
    return MatchSnapshot(
        snapshotId=_snapshot_id(provider, league, season, match_id),
        matchId=match_id,
        provider=provider,
        league=league,
        season=season,
        dataVersion=raw.get("dataVersion", "1.0.0"),
        data=raw,
        savedAt=now_utc(),
    )


def list_snapshots(
    provider: str | None = None,
    league: str | None = None,
    season: str | None = None,
) -> list[MatchSnapshot]:
    """List stored snapshots with optional filters."""
    entries = storage.list_snapshots(provider=provider, league=league, season=season)
    results: list[MatchSnapshot] = []
    for entry in entries:
        mid = entry["match_id"]
        prov = entry["provider"]
        lg = entry["league"]
        seas = entry["season"]
        try:
            raw = storage.load_snapshot(mid, prov, lg, seas)
        except FileNotFoundError:
            continue
        results.append(
            MatchSnapshot(
                snapshotId=_snapshot_id(prov, lg, seas, mid),
                matchId=mid,
                provider=prov,
                league=lg,
                season=seas,
                dataVersion=raw.get("dataVersion", "1.0.0"),
                data=raw,
                savedAt=now_utc(),
            )
        )
    return results


def delete_snapshot(match_id: str, provider: str, league: str, season: str) -> bool:
    """Delete a snapshot. Returns ``True`` if it existed."""
    return storage.delete_snapshot(match_id, provider, league, season)
