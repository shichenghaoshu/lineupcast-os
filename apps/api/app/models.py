"""SQLAlchemy ORM models for LineupCast OS PostgreSQL persistence.

These models replace the raw-SQLite layer in ``db.py`` with a portable,
relationship-aware schema suitable for PostgreSQL 16+ (and SQLite in dev).

All timestamps are stored as UTC.  Primary keys use auto-incrementing
integers for simplicity; ``external_id`` columns store provider-specific
identifiers where applicable.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Shared declarative base for all LineupCast models."""

    pass


# Use JSONB on PostgreSQL, fall back to generic JSON on SQLite.
# SQLAlchemy's ``JSON`` type silently adapts, but we explicitly pick JSONB
# so that PostgreSQL indexes can be created when targeting PG.
JSONType = JSONB


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------


class Provider(Base):
    """External data provider (e.g. football-data.org, StatsBomb)."""

    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active"
    )  # active | degraded | disabled
    last_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    capabilities: Mapped[Optional[dict]] = mapped_column(JSONType)  # e.g. {"matches": true, "lineups": true}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    runs: Mapped[list[ProviderRun]] = relationship(
        "ProviderRun", back_populates="provider", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Provider id={self.id} name={self.name!r} status={self.status!r}>"


# ---------------------------------------------------------------------------
# Provider Runs
# ---------------------------------------------------------------------------


class ProviderRun(Base):
    """A single sync run for a provider."""

    __tablename__ = "provider_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="synced"
    )  # synced | failed | partial
    records_synced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    provider: Mapped[Provider] = relationship("Provider", back_populates="runs")

    __table_args__ = (
        Index("ix_provider_runs_provider_id", "provider_id"),
        Index("ix_provider_runs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<ProviderRun id={self.id} provider_id={self.provider_id} "
            f"status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------


class Team(Base):
    """Football team / club."""

    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    short_name: Mapped[Optional[str]] = mapped_column(String(32))
    league: Mapped[Optional[str]] = mapped_column(String(128))
    country: Mapped[Optional[str]] = mapped_column(String(64))
    founded: Mapped[Optional[int]] = mapped_column(Integer)
    venue: Mapped[Optional[str]] = mapped_column(String(256))
    crest: Mapped[Optional[str]] = mapped_column(String(512))  # URL
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    players: Mapped[list[Player]] = relationship(
        "Player", back_populates="team", cascade="all, delete-orphan"
    )
    home_matches: Mapped[list[Match]] = relationship(
        "Match", foreign_keys="Match.home_team_id", back_populates="home_team"
    )
    away_matches: Mapped[list[Match]] = relationship(
        "Match", foreign_keys="Match.away_team_id", back_populates="away_team"
    )
    lineups: Mapped[list[Lineup]] = relationship(
        "Lineup", back_populates="team", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_teams_league", "league"),
        Index("ix_teams_external_id", "external_id"),
    )

    def __repr__(self) -> str:
        return f"<Team id={self.id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------


class Match(Base):
    """A single football match."""

    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    home_team_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL")
    )
    away_team_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL")
    )
    league: Mapped[Optional[str]] = mapped_column(String(128))
    season: Mapped[Optional[str]] = mapped_column(String(32))  # e.g. "2025/26"
    matchday: Mapped[Optional[int]] = mapped_column(Integer)
    kickoff: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    venue: Mapped[Optional[str]] = mapped_column(String(256))
    referee: Mapped[Optional[str]] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="scheduled"
    )  # scheduled | live | finished | postponed | cancelled
    home_score: Mapped[Optional[int]] = mapped_column(Integer)
    away_score: Mapped[Optional[int]] = mapped_column(Integer)
    minute: Mapped[Optional[int]] = mapped_column(Integer)
    data_source: Mapped[Optional[str]] = mapped_column(String(64))  # provider name
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    home_team: Mapped[Optional[Team]] = relationship(
        "Team", foreign_keys=[home_team_id], back_populates="home_matches"
    )
    away_team: Mapped[Optional[Team]] = relationship(
        "Team", foreign_keys=[away_team_id], back_populates="away_matches"
    )
    lineups: Mapped[list[Lineup]] = relationship(
        "Lineup", back_populates="match", cascade="all, delete-orphan"
    )
    predictions: Mapped[list[Prediction]] = relationship(
        "Prediction", back_populates="match", cascade="all, delete-orphan"
    )
    scripts: Mapped[list[Script]] = relationship(
        "Script", back_populates="match", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_matches_external_id", "external_id"),
        Index("ix_matches_league_season", "league", "season"),
        Index("ix_matches_kickoff", "kickoff"),
        Index("ix_matches_status", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Match id={self.id} home_team_id={self.home_team_id} "
            f"away_team_id={self.away_team_id} status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------


class Player(Base):
    """Individual player."""

    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    team_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    position: Mapped[Optional[str]] = mapped_column(String(32))  # GK | DEF | MID | FWD
    shirt_number: Mapped[Optional[int]] = mapped_column(Integer)
    nationality: Mapped[Optional[str]] = mapped_column(String(64))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    height: Mapped[Optional[int]] = mapped_column(Integer)  # cm
    weight: Mapped[Optional[int]] = mapped_column(Integer)  # kg
    injured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    injury_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    team: Mapped[Optional[Team]] = relationship("Team", back_populates="players")
    lineup_entries: Mapped[list[LineupPlayer]] = relationship(
        "LineupPlayer", back_populates="player"
    )
    stats_snapshots: Mapped[list[PlayerStatsSnapshot]] = relationship(
        "PlayerStatsSnapshot", back_populates="player", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_players_team_id", "team_id"),
        Index("ix_players_external_id", "external_id"),
        Index("ix_players_name", "name"),
    )

    def __repr__(self) -> str:
        return f"<Player id={self.id} name={self.name!r} team_id={self.team_id}>"


# ---------------------------------------------------------------------------
# Lineups
# ---------------------------------------------------------------------------


class Lineup(Base):
    """A team's lineup for a specific match."""

    __tablename__ = "lineups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    formation: Mapped[Optional[str]] = mapped_column(String(16))  # e.g. "4-3-3"
    coach: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    match: Mapped[Match] = relationship("Match", back_populates="lineups")
    team: Mapped[Team] = relationship("Team", back_populates="lineups")
    players: Mapped[list[LineupPlayer]] = relationship(
        "LineupPlayer", back_populates="lineup", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_lineups_match_id", "match_id"),
        Index("ix_lineups_team_id", "team_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Lineup id={self.id} match_id={self.match_id} "
            f"team_id={self.team_id} formation={self.formation!r}>"
        )


# ---------------------------------------------------------------------------
# Lineup Players (association table)
# ---------------------------------------------------------------------------


class LineupPlayer(Base):
    """Association between a lineup and a player, with positional data."""

    __tablename__ = "lineup_players"

    lineup_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lineups.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    is_starter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    position: Mapped[Optional[str]] = mapped_column(String(32))  # e.g. "LW", "CB"
    x: Mapped[Optional[float]] = mapped_column(Float)  # pitch coordinate 0-100
    y: Mapped[Optional[float]] = mapped_column(Float)  # pitch coordinate 0-100

    # Relationships
    lineup: Mapped[Lineup] = relationship("Lineup", back_populates="players")
    player: Mapped[Player] = relationship("Player", back_populates="lineup_entries")

    def __repr__(self) -> str:
        return (
            f"<LineupPlayer lineup_id={self.lineup_id} "
            f"player_id={self.player_id} starter={self.is_starter}>"
        )


# ---------------------------------------------------------------------------
# Player Stats Snapshots
# ---------------------------------------------------------------------------


class PlayerStatsSnapshot(Base):
    """Periodic snapshot of a player's aggregated statistics."""

    __tablename__ = "player_stats_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False
    )
    season: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. "2025/26"
    appearances: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    xg: Mapped[Optional[float]] = mapped_column(Float)
    xa: Mapped[Optional[float]] = mapped_column(Float)
    yellow_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    red_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    minutes_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[Optional[float]] = mapped_column(Float)  # 0-10 aggregate rating
    data_source: Mapped[Optional[str]] = mapped_column(String(64))
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    player: Mapped[Player] = relationship("Player", back_populates="stats_snapshots")

    __table_args__ = (
        Index("ix_player_stats_snapshots_player_id", "player_id"),
        Index("ix_player_stats_snapshots_season", "season"),
        Index(
            "ix_player_stats_snapshots_player_season_date",
            "player_id",
            "season",
            "snapshot_date",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<PlayerStatsSnapshot id={self.id} player_id={self.player_id} "
            f"season={self.season!r} date={self.snapshot_date}>"
        )


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------


class Prediction(Base):
    """A match outcome prediction produced by a model."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    home_win: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100 probability
    draw: Mapped[float] = mapped_column(Float, nullable=False)
    away_win: Mapped[float] = mapped_column(Float, nullable=False)
    expected_home_goals: Mapped[float] = mapped_column(Float, nullable=False)
    expected_away_goals: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)  # 0-1
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    data_completeness_score: Mapped[Optional[float]] = mapped_column(Float)  # 0-1
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    match: Mapped[Match] = relationship("Match", back_populates="predictions")
    inputs: Mapped[list[PredictionInput]] = relationship(
        "PredictionInput", back_populates="prediction", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_predictions_match_id", "match_id"),
        Index("ix_predictions_model_name", "model_name"),
        Index("ix_predictions_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Prediction id={self.id} match_id={self.match_id} "
            f"model={self.model_name!r} confidence={self.confidence}>"
        )


# ---------------------------------------------------------------------------
# Prediction Inputs
# ---------------------------------------------------------------------------


class PredictionInput(Base):
    """Raw input data captured when a prediction was generated."""

    __tablename__ = "prediction_inputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prediction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False
    )
    input_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # e.g. "lineup", "team_stats", "player_ratings"
    input_data: Mapped[Optional[dict]] = mapped_column(JSONType)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    prediction: Mapped[Prediction] = relationship("Prediction", back_populates="inputs")

    __table_args__ = (
        Index("ix_prediction_inputs_prediction_id", "prediction_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<PredictionInput id={self.id} prediction_id={self.prediction_id} "
            f"type={self.input_type!r}>"
        )


# ---------------------------------------------------------------------------
# Scripts
# ---------------------------------------------------------------------------


class Script(Base):
    """A generated broadcast/commentary script for a match."""

    __tablename__ = "scripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(16), nullable=False)  # en | zh | bilingual
    style: Mapped[Optional[str]] = mapped_column(String(32))  # broadcast | short-video | etc.
    duration: Mapped[Optional[str]] = mapped_column(String(16))  # 15s | 30s | 1min | 3min
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # the actual script text
    grounding_data: Mapped[Optional[dict]] = mapped_column(JSONType)  # prediction + lineup snapshot
    provider: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "lineupcast-ai-script"
    model: Mapped[str] = mapped_column(String(128), nullable=False)  # e.g. "GPT-4o@1.0.0"
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fallback: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    match: Mapped[Match] = relationship("Match", back_populates="scripts")

    __table_args__ = (
        Index("ix_scripts_match_id", "match_id"),
        Index("ix_scripts_language", "language"),
        Index("ix_scripts_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Script id={self.id} match_id={self.match_id} "
            f"language={self.language!r} provider={self.provider!r}>"
        )
