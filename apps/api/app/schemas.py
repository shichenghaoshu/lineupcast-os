"""Pydantic schemas for public API contracts."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadinessComponent(BaseModel):
    available: bool
    mode: str | None = None
    detail: str


class ReadinessProvider(BaseModel):
    id: str
    name: str
    status: str
    errorCount: int = 0
    lastError: str | None = None
    lastSuccessfulSync: str | None = None
    freshness: str = "unknown"
    health: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    missingCapabilities: list[str] = Field(default_factory=list)
    degradedReasons: list[str] = Field(default_factory=list)


class ReadinessResponse(BaseModel):
    status: Literal["ready", "degraded"]
    provider: ReadinessComponent
    model: ReadinessComponent
    providers: list[ReadinessProvider] = []
    providerFreshness: dict[str, str] = Field(default_factory=dict)
    errorCount: int = 0


class Coordinates(BaseModel):
    x: float
    y: float


class Player(BaseModel):
    playerId: str | None = None
    teamId: str | None = None
    number: int
    name: str
    position: str
    role: str
    age: int
    nationality: str
    recentRating: float
    xGLast5: float
    shotsLast5: int
    assistsLast5: int
    foulsPer90: float
    yellowCardsLast10: int
    vaepAttack: float
    vaepDefense: float
    commentaryNote: str
    coordinates: Coordinates


class Team(BaseModel):
    teamId: str
    name: str
    shortName: str
    crest: str | None = None


class TeamDetail(Team):
    founded: int
    venue: str
    league: str


class MatchSummary(BaseModel):
    matchId: str
    competition: str
    kickoff: str
    status: str
    homeTeam: Team
    awayTeam: Team
    score: dict[str, int] | None = None


class MatchImportRequest(BaseModel):
    matchId: str | None = None
    competition: str = "Imported Friendly"
    kickoff: str = "TBD"
    homeTeamId: str
    awayTeamId: str


class LineupTeam(BaseModel):
    teamId: str
    teamName: str
    formation: str
    players: list[Player]


class MatchLineups(BaseModel):
    matchId: str
    home: LineupTeam
    away: LineupTeam


class LineupRefreshResponse(BaseModel):
    matchId: str
    status: str
    provider: str
    refreshedAt: datetime


class GoalScorer(BaseModel):
    player: str
    team: str
    probability: int


class PredictionModelInfo(BaseModel):
    name: str
    version: str
    reference: str


class CardRisk(BaseModel):
    player: str
    team: str
    yellowRisk: int
    redRisk: Literal["low", "medium", "high"]
    redCardRisk: Literal["low", "medium", "high"]


class ModelReference(BaseModel):
    title: str
    url: str


class PredictionResponse(BaseModel):
    matchId: str
    homeWin: int
    draw: int
    awayWin: int
    expectedHomeGoals: float
    expectedAwayGoals: float
    modelName: str
    modelVersion: str
    confidence: float
    explanation: str
    references: list[ModelReference]
    goalScorers: list[GoalScorer]
    cardRisks: list[CardRisk]
    generatedAt: datetime
    inputFeatures: list[str]
    models: list[PredictionModelInfo]
    explanations: list[str]


class PredictionExplainResponse(BaseModel):
    matchId: str
    modelName: str
    modelVersion: str
    factors: list[str]
    references: list[ModelReference]


class BacktestResponse(BaseModel):
    matchId: str | None = None
    modelId: str | None = None
    sampleSize: int
    accuracy: float
    brierScore: float
    calibration: str


class ScriptLanguage(str, Enum):
    zh = "zh"
    en = "en"
    bilingual = "bilingual"


class ScriptGenerateRequest(BaseModel):
    language: ScriptLanguage = ScriptLanguage.en
    tone: str = "broadcast"
    style: Literal[
        "professional",
        "short-video",
        "passionate",
        "neutral",
        "broadcast",
    ] | None = None
    duration: Literal["15s", "30s", "1min", "3min"] = "30s"


class ScriptTranslateRequest(BaseModel):
    language: ScriptLanguage


class ScriptResponse(BaseModel):
    scriptId: str
    matchId: str
    language: ScriptLanguage
    title: str
    script: str
    provider: str
    model: str
    latencyMs: int = Field(ge=0)
    fallback: bool
    status: str
    generatedAt: datetime
    disclaimer: str


class LegacyScriptResponse(BaseModel):
    matchId: str
    script: str
    disclaimer: str


class ModelInfo(BaseModel):
    modelId: str
    name: str
    version: str
    provider: str
    task: str
    status: str


class ModelCardCalibrationBin(BaseModel):
    lowerBound: float
    upperBound: float
    count: int
    averagePrediction: float
    observedRate: float
    gap: float


class ModelCardFailureSegment(BaseModel):
    id: str
    description: str
    severity: Literal["warning", "critical"]
    sampleSize: int
    segmentBrierScore: float | None = None
    segmentLogLoss: float | None = None


class ModelCardDataSnapshot(BaseModel):
    provider: str
    league: str
    season: str
    dateRangeStart: str
    dateRangeEnd: str
    matchCount: int
    snapshotCreatedAt: str
    snapshotVersion: str | None = None


class ModelCardMetrics(BaseModel):
    sampleSize: int
    brierScore: float
    brierScoreConfidence: Literal["low", "medium", "high"]
    logLoss: float
    logLossConfidence: Literal["low", "medium", "high"]
    ece: float
    eceConfidence: Literal["low", "medium", "high"]


class ModelCard(BaseModel):
    modelId: str
    name: str
    intendedUse: str
    limitations: list[str]
    features: list[str]
    # Extended fields for data-snapshot-aware model cards
    version: str | None = None
    modelType: str | None = None
    references: list[str] = []
    notIntendedFor: list[str] = []
    outputs: list[str] = []
    metrics: ModelCardMetrics | None = None
    calibrationBins: list[ModelCardCalibrationBin] = []
    failureSegments: list[ModelCardFailureSegment] = []
    dataSnapshot: ModelCardDataSnapshot | None = None
    caveats: list[str] = []
    generatedAt: datetime | None = None
    schemaVersion: str = "1.0.0"


class ModelEvaluation(BaseModel):
    modelId: str
    sampleSize: int
    accuracy: float
    brierScore: float
    lastEvaluatedAt: datetime


class ModelBacktestRequest(BaseModel):
    modelId: str


class Provider(BaseModel):
    id: str
    name: str
    type: str
    description: str
    status: str
    errorCount: int = 0
    lastError: str | None = None
    lastSuccessfulSync: str | None = None
    freshness: str = "unknown"
    health: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    missingCapabilities: list[str] = Field(default_factory=list)
    degradedReasons: list[str] = Field(default_factory=list)


class ProviderTestRequest(BaseModel):
    providerId: str


class ProviderTestResponse(BaseModel):
    providerId: str
    ok: bool
    latencyMs: int
    detail: str


class ProviderSyncResponse(BaseModel):
    status: str
    providerCount: int
    syncedAt: datetime


class ProviderLog(BaseModel):
    providerId: str
    level: str
    message: str
    createdAt: datetime


class OverlayZone(BaseModel):
    type: str
    width: int
    height: int
    description: str


class OverlayLayout(BaseModel):
    matchId: str
    zones: dict[str, OverlayZone]


# ---------------------------------------------------------------------------
# Snapshot schemas
# ---------------------------------------------------------------------------


class MatchSnapshot(BaseModel):
    """A point-in-time capture of match data from a specific provider."""

    snapshotId: str = Field(
        description="Unique snapshot identifier (provider_league_season_matchId)."
    )
    matchId: str
    provider: str
    league: str
    season: str
    dataVersion: str = Field(
        default="1.0.0",
        description="Schema version of the stored data payload.",
    )
    data: dict = Field(
        default_factory=dict,
        description="Arbitrary JSON-serialisable match payload.",
    )
    savedAt: datetime = Field(
        default_factory=lambda: datetime.now(),
        description="UTC timestamp when the snapshot was persisted.",
    )


class SnapshotSaveRequest(BaseModel):
    """Request body for POST /api/snapshots."""

    matchId: str
    provider: str
    league: str
    season: str
    dataVersion: str = "1.0.0"
    data: dict = Field(default_factory=dict)


class SnapshotListResponse(BaseModel):
    """Wrapper returned by GET /api/snapshots."""

    snapshots: list[MatchSnapshot]
    total: int
