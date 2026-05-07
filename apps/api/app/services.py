"""Deterministic service layer backed by local mock data."""

from __future__ import annotations

from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from fastapi import HTTPException

from src.mock_data import LINEUPS, MATCH_DEMO, PLAYERS_DB, PREDICTION, PROVIDERS, TEAMS

from .config import Settings
from .schemas import (
    BacktestResponse,
    CardRisk,
    GoalScorer,
    LineupRefreshResponse,
    MatchImportRequest,
    MatchLineups,
    MatchSummary,
    ModelBacktestRequest,
    ModelCard,
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
    ReadinessResponse,
    ScriptGenerateRequest,
    ScriptLanguage,
    ScriptResponse,
    ScriptTranslateRequest,
    TeamDetail,
)

from .script_bridge import call_script_generator
from .prediction_bridge import call_prediction_engine


MATCHES: dict[str, dict] = {MATCH_DEMO["matchId"]: MATCH_DEMO.copy()}
SCRIPTS: dict[str, ScriptResponse] = {}


def now_utc() -> datetime:
    return datetime.now(UTC)


def _not_found(resource: str, resource_id: str) -> None:
    raise HTTPException(status_code=404, detail=f"{resource} '{resource_id}' not found")


def _player_with_id(player_id: str, player: dict) -> Player:
    return Player(playerId=player_id, **player)


def list_matches() -> list[MatchSummary]:
    return [MatchSummary(**match) for match in MATCHES.values()]


def get_match(match_id: str) -> MatchSummary:
    match = MATCHES.get(match_id)
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
    MATCHES[match_id] = match
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
        provider="mock-fixture-feed",
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
    match = MATCHES.get(match_id)
    if match is not None:
        bridge_input = {
            "matchId": match_id,
            "homeTeam": match.get("homeTeam", {}),
            "awayTeam": match.get("awayTeam", {}),
            "matchStats": PREDICTION.get("inputFeatures", {}),
            "lineups": LINEUPS.get(match_id, {}),
        }
        bridge_result = call_prediction_engine(bridge_input)
        if bridge_result is not None:
            return PredictionResponse(
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

    # ── Fallback to mock data ─────────────────────────────────────────────
    return PredictionResponse(
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
        f"{prediction.modelName} 认为主队胜率为 {prediction.homeWin}%，预计 xG 为 "
        f"{prediction.expectedHomeGoals:.1f} 比 {prediction.expectedAwayGoals:.1f}。"
        f"重点关注 {prediction.goalScorers[0].player} 的进球威胁。"
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
    match = MATCHES.get(match_id)
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
                SCRIPTS[script_response.scriptId] = script_response
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
    SCRIPTS[script_response.scriptId] = script_response
    return script_response


def list_scripts(match_id: str) -> list[ScriptResponse]:
    get_match(match_id)
    scripts = [script for script in SCRIPTS.values() if script.matchId == match_id]
    return sorted(scripts, key=lambda item: item.generatedAt, reverse=True)


def translate_script(
    settings: Settings, script_id: str, payload: ScriptTranslateRequest
) -> ScriptResponse:
    script = SCRIPTS.get(script_id)
    if not script:
        _not_found("Script", script_id)
    translated = generate_script(
        settings,
        script.matchId,
        ScriptGenerateRequest(language=payload.language, tone="translated"),
    )
    return translated.model_copy(update={"scriptId": script_id, "status": "translated"})


def list_models(settings: Settings) -> list[ModelInfo]:
    return [
        ModelInfo(
            modelId="lineupcast-ensemble",
            name=settings.prediction_model_name,
            version=settings.prediction_model_version,
            provider="local-deterministic",
            task="match-prediction",
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
    model = get_model(settings, model_id)
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


def get_model_evaluation(settings: Settings, model_id: str) -> ModelEvaluation:
    get_model(settings, model_id)
    return ModelEvaluation(
        modelId=model_id,
        sampleSize=240,
        accuracy=0.68,
        brierScore=0.19,
        lastEvaluatedAt=now_utc(),
    )


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
    return ProviderSyncResponse(
        status="synced",
        providerCount=len(PROVIDERS),
        syncedAt=now_utc(),
    )


def provider_logs() -> list[ProviderLog]:
    return [
        ProviderLog(
            providerId="mock-fixture-feed",
            level="info",
            message="Mock fixture feed ready.",
            createdAt=now_utc(),
        ),
        ProviderLog(
            providerId="lineupcast-xgboost",
            level="info",
            message="Deterministic model check passed.",
            createdAt=now_utc(),
        ),
    ]


def readiness(settings: Settings) -> ReadinessResponse:
    external_ready = settings.provider_mode != "external" or bool(settings.provider_api_key)
    return ReadinessResponse(
        status="ready" if external_ready else "degraded",
        provider=ReadinessComponent(
            available=external_ready,
            mode=settings.provider_mode,
            detail="mock provider ready"
            if settings.provider_mode == "mock"
            else "external provider key configured"
            if external_ready
            else "external provider key missing",
        ),
        model=ReadinessComponent(
            available=bool(settings.prediction_model_name),
            mode="deterministic",
            detail="model configured from environment",
        ),
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
