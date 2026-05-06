"""Pydantic models for the LineupCast API."""

from pydantic import BaseModel


class Coordinates(BaseModel):
    x: float
    y: float


class Player(BaseModel):
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


class LineupTeam(BaseModel):
    teamId: str
    teamName: str
    formation: str
    players: list[Player]


class MatchLineups(BaseModel):
    matchId: str
    home: LineupTeam
    away: LineupTeam


class ModelInfo(BaseModel):
    name: str
    version: str
    reference: str


class GoalScorer(BaseModel):
    player: str
    team: str
    probability: int


class CardRisk(BaseModel):
    player: str
    team: str
    yellowRisk: int
    redRisk: str


class Prediction(BaseModel):
    matchId: str
    homeWin: int
    draw: int
    awayWin: int
    expectedHomeGoals: float
    expectedAwayGoals: float
    confidence: float
    models: list[ModelInfo]
    inputFeatures: list[str]
    goalScorers: list[GoalScorer]
    cardRisks: list[CardRisk]
    explanations: list[str]


class ScriptResponse(BaseModel):
    matchId: str
    script: str
    disclaimer: str


class OverlayZone(BaseModel):
    type: str
    width: int
    height: int
    description: str


class OverlayLayout(BaseModel):
    matchId: str
    zones: dict[str, OverlayZone]


class Provider(BaseModel):
    id: str
    name: str
    type: str
    description: str
    status: str


class HealthResponse(BaseModel):
    status: str
    version: str
