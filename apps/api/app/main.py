"""FastAPI application factory and route declarations."""

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from src.mock_data import PROVIDERS

from .config import Settings, get_settings
from .security import require_admin
from . import services
from .leagues import get_leagues, get_league_by_id
from .routes.imports import router as imports_router
from .routes.users import router as users_router
from .schemas import (
    BacktestResponse,
    HealthResponse,
    LegacyScriptResponse,
    LineupRefreshResponse,
    MatchImportRequest,
    MatchLineups,
    MatchSnapshot,
    MatchSummary,
    ModelBacktestRequest,
    ModelCard,
    ModelEvaluation,
    ModelInfo,
    OverlayLayout,
    Player,
    PredictionExplainResponse,
    PredictionResponse,
    Provider,
    ProviderLog,
    ProviderSyncResponse,
    ProviderTestRequest,
    ProviderTestResponse,
    ReadinessResponse,
    ScriptGenerateRequest,
    ScriptResponse,
    ScriptTranslateRequest,
    SnapshotListResponse,
    SnapshotSaveRequest,
    TeamDetail,
)


def create_app() -> FastAPI:
    settings = get_settings()
    api = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description="Deployable football prediction and commentary API.",
    )
    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials="*" not in settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_routes(api)
    return api


def register_routes(api: FastAPI) -> None:
    api.include_router(imports_router)
    api.include_router(users_router)

    @api.get("/healthz", response_model=HealthResponse)
    async def healthz(settings: Settings = Depends(get_settings)) -> HealthResponse:
        return HealthResponse(status="ok", version=settings.version)

    @api.get("/health", response_model=HealthResponse)
    async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
        return HealthResponse(status="ok", version=settings.version)

    @api.get("/readyz", response_model=ReadinessResponse)
    async def readyz(settings: Settings = Depends(get_settings)) -> ReadinessResponse:
        return services.readiness(settings)

    @api.get("/api/matches", response_model=list[MatchSummary])
    async def list_matches() -> list[MatchSummary]:
        return services.list_matches()

    @api.get("/api/matches/demo", response_model=MatchSummary)
    async def get_demo_match() -> MatchSummary:
        return services.get_match("demo-manchester-red-vs-shanghai-harbor")

    @api.get("/api/matches/{match_id}", response_model=MatchSummary)
    async def get_match(match_id: str) -> MatchSummary:
        return services.get_match(match_id)

    @api.post(
        "/api/matches/import",
        response_model=MatchSummary,
        status_code=status.HTTP_201_CREATED,
    )
    async def import_match(payload: MatchImportRequest, _: Settings = Depends(require_admin)) -> MatchSummary:
        return services.import_match(payload)

    @api.get("/api/teams/{team_id}", response_model=TeamDetail)
    async def get_team(team_id: str) -> TeamDetail:
        return services.get_team(team_id)

    @api.get("/api/players/{player_id}", response_model=Player)
    async def get_player(player_id: str) -> Player:
        return services.get_player(player_id)

    @api.get("/api/matches/{match_id}/players", response_model=list[Player])
    async def get_match_players(match_id: str) -> list[Player]:
        return services.get_match_players(match_id)

    @api.get("/api/matches/{match_id}/lineups", response_model=MatchLineups)
    async def get_match_lineups(match_id: str) -> MatchLineups:
        return services.get_lineups(match_id)

    @api.post(
        "/api/matches/{match_id}/lineups/refresh",
        response_model=LineupRefreshResponse,
    )
    async def refresh_match_lineups(match_id: str, _: Settings = Depends(require_admin)) -> LineupRefreshResponse:
        return services.refresh_lineups(match_id)

    @api.post("/api/matches/{match_id}/predict", response_model=PredictionResponse)
    async def predict_match(
        match_id: str, settings: Settings = Depends(require_admin)
    ) -> PredictionResponse:
        return services.get_prediction(settings, match_id)

    @api.get("/api/matches/{match_id}/prediction", response_model=PredictionResponse)
    async def get_match_prediction(
        match_id: str, settings: Settings = Depends(get_settings)
    ) -> PredictionResponse:
        return services.get_prediction(settings, match_id)

    @api.get(
        "/api/matches/{match_id}/prediction/explain",
        response_model=PredictionExplainResponse,
    )
    async def explain_match_prediction(
        match_id: str, settings: Settings = Depends(get_settings)
    ) -> PredictionExplainResponse:
        return services.explain_prediction(settings, match_id)

    @api.get(
        "/api/matches/{match_id}/prediction/backtest",
        response_model=BacktestResponse,
    )
    async def backtest_match_prediction(match_id: str) -> BacktestResponse:
        return services.backtest_prediction(match_id)

    @api.post(
        "/api/matches/{match_id}/scripts/generate",
        response_model=ScriptResponse,
    )
    async def generate_match_script(
        match_id: str,
        payload: ScriptGenerateRequest | None = None,
        settings: Settings = Depends(require_admin),
    ) -> ScriptResponse:
        return services.generate_script(
            settings, match_id, payload or ScriptGenerateRequest()
        )

    @api.get("/api/matches/{match_id}/scripts", response_model=list[ScriptResponse])
    async def get_match_scripts(match_id: str) -> list[ScriptResponse]:
        return services.list_scripts(match_id)

    @api.post("/api/scripts/{script_id}/translate", response_model=ScriptResponse)
    async def translate_script(
        script_id: str,
        payload: ScriptTranslateRequest,
        settings: Settings = Depends(require_admin),
    ) -> ScriptResponse:
        return services.translate_script(settings, script_id, payload)

    @api.post("/api/matches/{match_id}/script", response_model=LegacyScriptResponse)
    async def generate_legacy_script(
        match_id: str, settings: Settings = Depends(require_admin)
    ) -> LegacyScriptResponse:
        script = services.generate_script(settings, match_id, ScriptGenerateRequest())
        return LegacyScriptResponse(
            matchId=script.matchId,
            script=script.script,
            disclaimer=script.disclaimer,
        )

    @api.get("/api/models", response_model=list[ModelInfo])
    async def list_models(
        settings: Settings = Depends(get_settings),
    ) -> list[ModelInfo]:
        return services.list_models(settings)

    @api.post("/api/models/backtest", response_model=BacktestResponse)
    async def backtest_model(
        payload: ModelBacktestRequest, settings: Settings = Depends(require_admin)
    ) -> BacktestResponse:
        return services.backtest_model(settings, payload)

    @api.get("/api/models/{model_id}", response_model=ModelInfo)
    async def get_model(
        model_id: str, settings: Settings = Depends(get_settings)
    ) -> ModelInfo:
        return services.get_model(settings, model_id)

    @api.get("/api/models/{model_id}/card", response_model=ModelCard)
    async def get_model_card(
        model_id: str, settings: Settings = Depends(get_settings)
    ) -> ModelCard:
        return services.get_model_card(settings, model_id)

    @api.get("/api/models/{model_id}/card/markdown")
    async def get_model_card_markdown(
        model_id: str, settings: Settings = Depends(get_settings)
    ) -> Response:
        markdown = services.get_model_card_markdown(settings, model_id)
        return Response(content=markdown, media_type="text/markdown")

    @api.get("/api/models/{model_id}/evaluation", response_model=ModelEvaluation)
    async def get_model_evaluation(
        model_id: str, settings: Settings = Depends(get_settings)
    ) -> ModelEvaluation:
        return services.get_model_evaluation(settings, model_id)

    @api.get("/api/providers", response_model=list[Provider])
    async def get_providers() -> list[Provider]:
        return [Provider(**provider) for provider in PROVIDERS]

    @api.post("/api/providers/test", response_model=ProviderTestResponse)
    async def test_provider(payload: ProviderTestRequest, _: Settings = Depends(require_admin)) -> ProviderTestResponse:
        return services.test_provider(payload)

    @api.post("/api/providers/sync", response_model=ProviderSyncResponse)
    async def sync_providers(_: Settings = Depends(require_admin)) -> ProviderSyncResponse:
        return services.sync_providers()

    @api.get("/api/providers/logs", response_model=list[ProviderLog])
    async def get_provider_logs() -> list[ProviderLog]:
        return services.provider_logs()

    @api.get("/api/matches/{match_id}/overlay", response_model=OverlayLayout)
    async def get_match_overlay(match_id: str) -> OverlayLayout:
        return services.overlay(match_id)

    @api.get("/api/leagues")
    async def list_leagues() -> list[dict]:
        return get_leagues()

    @api.get("/api/leagues/{league_id}")
    async def get_league(league_id: str) -> dict:
        league = get_league_by_id(league_id)
        if not league:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"League '{league_id}' not found")
        return league

    # ── Snapshot endpoints ─────────────────────────────────────────────────

    @api.get("/api/snapshots", response_model=SnapshotListResponse)
    async def list_snapshots(
        provider: str | None = None,
        league: str | None = None,
        season: str | None = None,
    ) -> SnapshotListResponse:
        snapshots = services.list_snapshots(
            provider=provider, league=league, season=season
        )
        return SnapshotListResponse(snapshots=snapshots, total=len(snapshots))

    @api.get(
        "/api/snapshots/{provider}/{league}/{season}/{match_id}",
        response_model=MatchSnapshot,
    )
    async def get_snapshot(
        provider: str, league: str, season: str, match_id: str
    ) -> MatchSnapshot:
        return services.load_snapshot(match_id, provider, league, season)

    @api.post(
        "/api/snapshots",
        response_model=MatchSnapshot,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_snapshot(
        payload: SnapshotSaveRequest, _: Settings = Depends(require_admin)
    ) -> MatchSnapshot:
        return services.save_snapshot(payload)


app = create_app()
