"""CSV import service for parsing lineup, player stats, and match history CSVs."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any


class CsvValidationError(Exception):
    """Raised when CSV validation fails."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"CSV validation failed: {'; '.join(errors)}")


@dataclass
class LineupRow:
    team_name: str
    player_name: str
    position: str
    shirt_number: int
    is_starter: bool
    x: float
    y: float


@dataclass
class PlayerStatsRow:
    player_name: str
    team_name: str
    position: str
    appearances: int
    goals: int
    assists: int
    xg: float
    xa: float
    yellow_cards: int
    red_cards: int
    minutes_played: int
    rating: float


@dataclass
class MatchHistoryRow:
    date: str
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    competition: str
    venue: str


# ── Helpers ──────────────────────────────────────────────────────────────


def _strip_bom(text: str) -> str:
    """Remove UTF-8 BOM if present."""
    return text.lstrip("\ufeff")


def _parse_bool(value: str) -> bool:
    """Parse a boolean from various string representations."""
    lower = value.strip().lower()
    if lower in ("true", "1", "yes", "y", "t"):
        return True
    if lower in ("false", "0", "no", "n", "f"):
        return False
    raise ValueError(f"Cannot parse '{value}' as boolean")


def _to_int(value: str, field: str, row: int = 0) -> tuple[int, str | None]:
    """Convert string to int. Returns (value, error_msg_or_None)."""
    try:
        return int(value.strip()), None
    except ValueError:
        return 0, f"Row {row}: Invalid integer for {field}: '{value}'"


def _to_float(value: str, field: str, row: int = 0) -> tuple[float, str | None]:
    """Convert string to float. Returns (value, error_msg_or_None)."""
    try:
        return float(value.strip()), None
    except ValueError:
        return 0.0, f"Row {row}: Invalid float for {field}: '{value}'"


def _validate_headers(actual: list[str], required: list[str], context: str = "") -> list[str]:
    """Validate that all required headers are present. Returns error messages."""
    actual_lower = {h.strip().lower() for h in actual}
    missing = [h for h in required if h.lower() not in actual_lower]
    if not missing:
        return []
    return [f"Missing required columns: {', '.join(missing)}. Expected: {', '.join(required)}"]


def _read_csv(content: str) -> tuple[list[str], list[dict[str, str]]]:
    """Parse CSV content into headers and row dicts. Raises on empty."""
    text = _strip_bom(content.strip())
    if not text:
        raise CsvValidationError(["CSV file is empty or has no headers"])
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    if not headers:
        raise CsvValidationError(["CSV file is empty or has no headers"])
    rows = list(reader)
    return headers, rows


# ── Parse functions ──────────────────────────────────────────────────────


def parse_lineup_csv(content: str) -> list[LineupRow]:
    """Parse a lineup CSV into LineupRow objects."""
    required = ["team_name", "player_name", "position", "shirt_number", "is_starter", "x", "y"]
    headers, rows = _read_csv(content)

    header_errors = _validate_headers(headers, required, "lineup")
    if header_errors:
        raise CsvValidationError(header_errors)

    result: list[LineupRow] = []
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):
        row_errors: list[str] = []

        shirt, err = _to_int(row.get("shirt_number", ""), "shirt_number", i)
        if err:
            row_errors.append(err)

        x_val, err = _to_float(row.get("x", ""), "x", i)
        if err:
            row_errors.append(err)

        y_val, err = _to_float(row.get("y", ""), "y", i)
        if err:
            row_errors.append(err)

        try:
            is_starter = _parse_bool(row.get("is_starter", ""))
        except ValueError as e:
            row_errors.append(f"Row {i}: {e}")

        if row_errors:
            errors.extend(row_errors)
        else:
            result.append(LineupRow(
                team_name=row.get("team_name", "").strip(),
                player_name=row.get("player_name", "").strip(),
                position=row.get("position", "").strip(),
                shirt_number=shirt,
                is_starter=is_starter,
                x=x_val,
                y=y_val,
            ))

    if errors:
        raise CsvValidationError(errors)
    return result


def parse_player_stats_csv(content: str) -> list[PlayerStatsRow]:
    """Parse a player stats CSV into PlayerStatsRow objects."""
    required = [
        "player_name", "team_name", "position", "appearances",
        "goals", "assists", "xg", "xa",
        "yellow_cards", "red_cards", "minutes_played", "rating",
    ]
    headers, rows = _read_csv(content)

    header_errors = _validate_headers(headers, required, "player_stats")
    if header_errors:
        raise CsvValidationError(header_errors)

    result: list[PlayerStatsRow] = []
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):
        row_errors: list[str] = []

        apps, err = _to_int(row.get("appearances", ""), "appearances", i)
        if err: row_errors.append(err)

        goals, err = _to_int(row.get("goals", ""), "goals", i)
        if err: row_errors.append(err)

        assists, err = _to_int(row.get("assists", ""), "assists", i)
        if err: row_errors.append(err)

        xg, err = _to_float(row.get("xg", row.get("xG", "")), "xg", i)
        if err: row_errors.append(err)

        xa, err = _to_float(row.get("xa", "0"), "xa", i)
        if err: row_errors.append(err)

        yc, err = _to_int(row.get("yellow_cards", ""), "yellow_cards", i)
        if err: row_errors.append(err)

        rc, err = _to_int(row.get("red_cards", ""), "red_cards", i)
        if err: row_errors.append(err)

        mins, err = _to_int(row.get("minutes_played", ""), "minutes_played", i)
        if err: row_errors.append(err)

        rating, err = _to_float(row.get("rating", ""), "rating", i)
        if err: row_errors.append(err)

        if row_errors:
            errors.extend(row_errors)
        else:
            result.append(PlayerStatsRow(
                player_name=row.get("player_name", "").strip(),
                team_name=row.get("team_name", "").strip(),
                position=row.get("position", "").strip(),
                appearances=apps,
                goals=goals,
                assists=assists,
                xg=xg,
                xa=xa,
                yellow_cards=yc,
                red_cards=rc,
                minutes_played=mins,
                rating=rating,
            ))

    if errors:
        raise CsvValidationError(errors)
    return result


def parse_match_history_csv(content: str) -> list[MatchHistoryRow]:
    """Parse a match history CSV into MatchHistoryRow objects."""
    required = ["date", "home_team", "away_team", "home_score", "away_score", "competition"]
    headers, rows = _read_csv(content)

    header_errors = _validate_headers(headers, required, "match_history")
    if header_errors:
        raise CsvValidationError(header_errors)

    result: list[MatchHistoryRow] = []
    errors: list[str] = []

    for i, row in enumerate(rows, start=2):
        row_errors: list[str] = []

        hs, err = _to_int(row.get("home_score", ""), "home_score", i)
        if err: row_errors.append(err)

        as_, err = _to_int(row.get("away_score", ""), "away_score", i)
        if err: row_errors.append(err)

        if row_errors:
            errors.extend(row_errors)
        else:
            result.append(MatchHistoryRow(
                date=row.get("date", "").strip(),
                home_team=row.get("home_team", "").strip(),
                away_team=row.get("away_team", "").strip(),
                home_score=hs,
                away_score=as_,
                competition=row.get("competition", "").strip(),
                venue=row.get("venue", "").strip(),
            ))

    if errors:
        raise CsvValidationError(errors)
    return result
