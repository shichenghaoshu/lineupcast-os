"""CSV import service for parsing lineup, player stats, and match history CSVs.

Supports:
- Dry-run mode (validate without persisting)
- Validation warnings (non-fatal issues)
- Parsed rows count in response
- Missing field report
- Import result summary
- CSV template generation
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import Any


# ── Exceptions ──────────────────────────────────────────────────────────


class CsvValidationError(Exception):
    """Raised when CSV validation fails."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"CSV validation failed: {'; '.join(errors)}")


# ── Data classes ─────────────────────────────────────────────────────────


@dataclass
class ImportResult:
    """Result of a CSV import operation (parse or dry-run)."""

    import_type: str
    total_rows: int
    parsed_rows: int
    skipped_rows: int
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    missing_fields: list[str] = field(default_factory=list)
    preview: list[dict[str, Any]] = field(default_factory=list)
    all_rows: list[dict[str, Any]] = field(default_factory=list, repr=False)
    dry_run: bool = False
    saved: bool = False
    import_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "importType": self.import_type,
            "totalRows": self.total_rows,
            "parsedRows": self.parsed_rows,
            "skippedRows": self.skipped_rows,
            "errors": self.errors,
            "warnings": self.warnings,
            "missingFields": self.missing_fields,
            "preview": self.preview,
            "dryRun": self.dry_run,
            "saved": self.saved,
        }
        if self.import_id:
            result["importId"] = self.import_id
        return result


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


# ── CSV column schemas ──────────────────────────────────────────────────

LINEUP_COLUMNS: list[dict[str, Any]] = [
    {"name": "team_name", "type": "string", "required": True, "description": "Name of the team"},
    {"name": "player_name", "type": "string", "required": True, "description": "Full name of the player"},
    {"name": "position", "type": "string", "required": True, "description": "Position code (GK, DEF, MID, FWD)"},
    {"name": "shirt_number", "type": "integer", "required": True, "description": "Jersey number"},
    {"name": "is_starter", "type": "boolean", "required": True, "description": "true/false or 1/0"},
    {"name": "x", "type": "float", "required": True, "description": "X coordinate on pitch (0.0-100.0)"},
    {"name": "y", "type": "float", "required": True, "description": "Y coordinate on pitch (0.0-100.0)"},
]

PLAYER_STATS_COLUMNS: list[dict[str, Any]] = [
    {"name": "player_name", "type": "string", "required": True, "description": "Full name of the player"},
    {"name": "team_name", "type": "string", "required": True, "description": "Name of the team"},
    {"name": "position", "type": "string", "required": True, "description": "Position code (GK, DEF, MID, FWD)"},
    {"name": "appearances", "type": "integer", "required": True, "description": "Number of matches played"},
    {"name": "goals", "type": "integer", "required": True, "description": "Goals scored"},
    {"name": "assists", "type": "integer", "required": True, "description": "Assists made"},
    {"name": "xg", "type": "float", "required": True, "description": "Expected goals"},
    {"name": "xa", "type": "float", "required": True, "description": "Expected assists"},
    {"name": "yellow_cards", "type": "integer", "required": True, "description": "Yellow cards received"},
    {"name": "red_cards", "type": "integer", "required": True, "description": "Red cards received"},
    {"name": "minutes_played", "type": "integer", "required": True, "description": "Total minutes on pitch"},
    {"name": "rating", "type": "float", "required": True, "description": "Average match rating (0.0-10.0)"},
]

MATCH_HISTORY_COLUMNS: list[dict[str, Any]] = [
    {"name": "date", "type": "string", "required": True, "description": "Match date (YYYY-MM-DD)"},
    {"name": "home_team", "type": "string", "required": True, "description": "Home team name"},
    {"name": "away_team", "type": "string", "required": True, "description": "Away team name"},
    {"name": "home_score", "type": "integer", "required": True, "description": "Home team final score"},
    {"name": "away_score", "type": "integer", "required": True, "description": "Away team final score"},
    {"name": "competition", "type": "string", "required": True, "description": "Competition or league name"},
    {"name": "venue", "type": "string", "required": False, "description": "Stadium name (optional)"},
]

COLUMN_SCHEMAS: dict[str, list[dict[str, Any]]] = {
    "lineup": LINEUP_COLUMNS,
    "player_stats": PLAYER_STATS_COLUMNS,
    "match_history": MATCH_HISTORY_COLUMNS,
}


# ── Helpers ──────────────────────────────────────────────────────────────


def _strip_bom(text: str) -> str:
    """Remove UTF-8 BOM if present."""
    return text.lstrip("﻿")


def _normalize_line_endings(text: str) -> str:
    """Normalize mixed line endings (\\r\\n, \\r) to \\n."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _parse_bool(value: str) -> bool:
    """Parse a boolean from various string representations."""
    lower = value.strip().lower()
    if lower in ("true", "1", "yes", "y", "t"):
        return True
    if lower in ("false", "0", "no", "n", "f"):
        return False
    raise ValueError(f"Cannot parse '{value}' as boolean")


def _to_int(value: str, field_name: str, row: int = 0) -> tuple[int, str | None]:
    """Convert string to int. Returns (value, error_msg_or_None)."""
    try:
        return int(value.strip()), None
    except ValueError:
        return 0, f"Row {row}: Invalid integer for {field_name}: '{value}'"


def _to_float(value: str, field_name: str, row: int = 0) -> tuple[float, str | None]:
    """Convert string to float. Returns (value, error_msg_or_None)."""
    try:
        return float(value.strip()), None
    except ValueError:
        return 0.0, f"Row {row}: Invalid float for {field_name}: '{value}'"


def _validate_headers(actual: list[str], required: list[str], context: str = "") -> list[str]:
    """Validate that all required headers are present. Returns error messages."""
    actual_lower = {h.strip().lower() for h in actual}
    missing = [h for h in required if h.lower() not in actual_lower]
    if not missing:
        return []
    return [f"Missing required columns: {', '.join(missing)}. Expected: {', '.join(required)}"]


def _detect_missing_fields(actual: list[str], schema: list[dict[str, Any]]) -> list[str]:
    """Detect columns present in CSV but missing from the schema, and vice versa."""
    actual_set = {h.strip().lower() for h in actual}
    expected_set = {c["name"].lower() for c in schema}
    missing_from_csv = sorted(expected_set - actual_set)
    extra_in_csv = sorted(actual_set - expected_set)
    report: list[str] = []
    if missing_from_csv:
        report.append(f"Columns missing from CSV: {', '.join(missing_from_csv)}")
    if extra_in_csv:
        report.append(f"Extra columns in CSV (ignored): {', '.join(extra_in_csv)}")
    return report


def _collect_warnings(
    rows: list[dict[str, str]], schema: list[dict[str, Any]], import_type: str
) -> list[str]:
    """Collect non-fatal validation warnings for a parsed CSV."""
    warnings: list[str] = []

    # Check for empty required fields
    for i, row in enumerate(rows, start=2):
        for col in schema:
            name = col["name"]
            value = row.get(name, "").strip()
            if col.get("required") and not value:
                warnings.append(f"Row {i}: Empty value for required field '{name}'")

    # Check for duplicate rows (by all required fields)
    seen: set[tuple[str, ...]] = set()
    for i, row in enumerate(rows, start=2):
        key = tuple(row.get(c["name"], "").strip().lower() for c in schema if c.get("required"))
        if key in seen:
            warnings.append(f"Row {i}: Duplicate row detected")
        seen.add(key)

    return warnings


def _read_csv(content: str) -> tuple[list[str], list[dict[str, str]]]:
    """Parse CSV content into headers and row dicts. Raises on empty."""
    text = _strip_bom(content.strip())
    text = _normalize_line_endings(text)
    if not text:
        raise CsvValidationError(["CSV file is empty or has no headers"])
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    if not headers:
        raise CsvValidationError(["CSV file is empty or has no headers"])
    rows = list(reader)
    return headers, rows


# ── Template generation ─────────────────────────────────────────────────


def generate_csv_template(import_type: str) -> str:
    """Generate a CSV template string for the given import type.

    Returns the template as a string with headers and two example rows.
    Raises ValueError for unknown import types.
    """
    schema = COLUMN_SCHEMAS.get(import_type)
    if schema is None:
        raise ValueError(
            f"Unknown import type: {import_type}. Valid types: {', '.join(COLUMN_SCHEMAS)}"
        )

    headers = [c["name"] for c in schema]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    if import_type == "lineup":
        writer.writerow(["Arsenal", "Bukayo Saka", "MID", "7", "true", "75.0", "50.0"])
        writer.writerow(["Arsenal", "Martin Odegaard", "MID", "8", "true", "60.0", "45.0"])
    elif import_type == "player_stats":
        writer.writerow(["Bukayo Saka", "Arsenal", "MID", "38", "14", "11", "12.5", "9.8", "3", "0", "3200", "7.4"])
        writer.writerow(["Martin Odegaard", "Arsenal", "MID", "35", "8", "12", "7.2", "10.1", "5", "0", "2900", "7.1"])
    elif import_type == "match_history":
        writer.writerow(["2024-08-12", "Arsenal", "Wolves", "2", "0", "Premier League", "Emirates Stadium"])
        writer.writerow(["2024-08-19", "Aston Villa", "Arsenal", "0", "2", "Premier League", "Villa Park"])

    return output.getvalue()


def get_template_info() -> dict[str, dict[str, Any]]:
    """Return template metadata for all import types."""
    templates: dict[str, dict[str, Any]] = {}
    for import_type, schema in COLUMN_SCHEMAS.items():
        templates[import_type] = {
            "columns": [
                {
                    "name": c["name"],
                    "type": c["type"],
                    "required": c["required"],
                    "description": c["description"],
                }
                for c in schema
            ],
            "required_columns": [c["name"] for c in schema if c["required"]],
            "optional_columns": [c["name"] for c in schema if not c["required"]],
            "filename": f"{import_type}.csv",
        }
    return templates


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
        if err:
            row_errors.append(err)

        goals, err = _to_int(row.get("goals", ""), "goals", i)
        if err:
            row_errors.append(err)

        assists, err = _to_int(row.get("assists", ""), "assists", i)
        if err:
            row_errors.append(err)

        xg, err = _to_float(row.get("xg", row.get("xG", "")), "xg", i)
        if err:
            row_errors.append(err)

        xa, err = _to_float(row.get("xa", "0"), "xa", i)
        if err:
            row_errors.append(err)

        yc, err = _to_int(row.get("yellow_cards", ""), "yellow_cards", i)
        if err:
            row_errors.append(err)

        rc, err = _to_int(row.get("red_cards", ""), "red_cards", i)
        if err:
            row_errors.append(err)

        mins, err = _to_int(row.get("minutes_played", ""), "minutes_played", i)
        if err:
            row_errors.append(err)

        rating, err = _to_float(row.get("rating", ""), "rating", i)
        if err:
            row_errors.append(err)

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
        if err:
            row_errors.append(err)

        as_, err = _to_int(row.get("away_score", ""), "away_score", i)
        if err:
            row_errors.append(err)

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


# ── Enhanced parse with ImportResult ─────────────────────────────────────

_PARSE_FN_MAP: dict[str, Any] = {
    "lineup": parse_lineup_csv,
    "player_stats": parse_player_stats_csv,
    "match_history": parse_match_history_csv,
}


def parse_csv(content: str, import_type: str) -> ImportResult:
    """Parse CSV content and return a rich ImportResult with warnings.

    This is the main entry point that combines parsing, validation,
    warnings, and missing-field detection.
    """
    schema = COLUMN_SCHEMAS.get(import_type)
    if schema is None:
        raise ValueError(f"Unknown import type: {import_type}")

    parse_fn = _PARSE_FN_MAP.get(import_type)
    if parse_fn is None:
        raise ValueError(f"Unknown import type: {import_type}")

    # Read raw CSV for warnings and field analysis
    headers, raw_rows = _read_csv(content)
    total_rows = len(raw_rows)

    # Detect missing / extra fields
    missing_fields = _detect_missing_fields(headers, schema)

    # Collect warnings (non-fatal issues)
    warnings = _collect_warnings(raw_rows, schema, import_type)

    # Attempt full parse
    errors: list[str] = []
    parsed_rows = 0
    skipped_rows = 0
    preview: list[dict[str, Any]] = []

    all_row_dicts: list[dict[str, Any]] = []

    try:
        parsed = parse_fn(content)
        parsed_rows = len(parsed)
        skipped_rows = total_rows - parsed_rows
        # Build all row dicts and preview from dataclass objects
        for obj in parsed:
            row_dict = _dataclass_to_dict(obj)
            all_row_dicts.append(row_dict)
        preview = all_row_dicts[:5]
    except CsvValidationError as exc:
        errors = exc.errors
        skipped_rows = total_rows

    return ImportResult(
        import_type=import_type,
        total_rows=total_rows,
        parsed_rows=parsed_rows,
        skipped_rows=skipped_rows,
        errors=errors,
        warnings=warnings,
        missing_fields=missing_fields,
        preview=preview,
        all_rows=all_row_dicts,
    )


def _dataclass_to_dict(obj: Any) -> dict[str, Any]:
    """Convert a dataclass to a plain dict."""
    if hasattr(obj, "__dataclass_fields__"):
        return {k: getattr(obj, k) for k in obj.__dataclass_fields__}
    return {}
