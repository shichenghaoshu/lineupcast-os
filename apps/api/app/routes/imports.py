"""CSV import routes for lineup, player-stats, and match-history data.

Each endpoint:
1. Accepts a CSV file upload.
2. Validates CSV headers against the expected template.
3. Parses rows into structured dicts.
4. Returns a preview (first 5 rows) plus the total row count.
5. Optionally persists the parsed data when ``?save=true`` is provided.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

router = APIRouter(prefix="/api/import", tags=["import"])

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Expected CSV headers for each import type
# ---------------------------------------------------------------------------

LINEUP_EXPECTED_HEADERS: set[str] = {
    "team",
    "formation",
    "player_number",
    "player_name",
    "position",
    "role",
    "is_starter",
}

PLAYER_STATS_EXPECTED_HEADERS: set[str] = {
    "player_name",
    "team",
    "position",
    "appearances",
    "goals",
    "assists",
    "xG",
    "shots",
    "shots_on_target",
    "minutes_played",
    "yellow_cards",
    "red_cards",
    "rating",
}

MATCH_HISTORY_EXPECTED_HEADERS: set[str] = {
    "date",
    "home_team",
    "away_team",
    "home_score",
    "away_score",
    "competition",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


async def _read_csv(file: UploadFile) -> tuple[list[str], list[dict[str, str]]]:
    """Read an uploaded CSV file and return (headers, rows_as_dicts).

    Raises ``HTTPException(400)`` when the file cannot be decoded as valid CSV.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must have a .csv extension.",
        )

    try:
        raw = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {exc}") from exc

    try:
        text = raw.decode("utf-8-sig")  # handle BOM transparently
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"File is not valid UTF-8 text: {exc}",
        ) from exc

    if not text.strip():
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    try:
        reader = csv.DictReader(io.StringIO(text))
        headers = list(reader.fieldnames or [])
        rows = list(reader)
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail=f"Malformed CSV: {exc}") from exc

    return headers, rows


def _validate_headers(
    actual: list[str], expected: set[str], label: str
) -> None:
    """Reject the request when required headers are missing."""
    actual_set = {h.strip() for h in actual}
    missing = expected - actual_set
    if missing:
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV for '{label}' is missing required columns: "
                f"{', '.join(sorted(missing))}. "
                f"Expected columns: {', '.join(sorted(expected))}."
            ),
        )


def _preview_response(
    rows: list[dict[str, Any]], *, import_type: str
) -> dict[str, Any]:
    """Build the standard import-preview payload."""
    return {
        "importType": import_type,
        "totalRows": len(rows),
        "preview": rows[:5],
        "importedAt": _now_iso(),
    }


def _persist_import(
    rows: list[dict[str, Any]], *, import_type: str, filename: str
) -> str:
    """Write parsed import data to ``data/imports/<import_id>.json``.

    Returns the import id.
    """
    from pathlib import Path

    import_id = f"imp_{uuid4().hex[:12]}"
    data_dir = Path(__file__).resolve().parent.parent.parent / "data" / "imports"
    data_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "importId": import_id,
        "importType": import_type,
        "filename": filename,
        "totalRows": len(rows),
        "rows": rows,
        "importedAt": _now_iso(),
    }

    path = data_dir / f"{import_id}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    logger.info("Persisted %s import %s (%d rows) to %s", import_type, import_id, len(rows), path)
    return import_id


def _persist_match_history(rows: list[dict[str, Any]]) -> int:
    """Attempt to create match records for match-history imports.

    Returns the count of matches saved.
    """
    try:
        from ..db import get_db
    except Exception:
        return 0

    db = get_db()
    saved = 0
    for row in rows:
        home_id = row.get("home_team", "").lower().replace(" ", "-")
        away_id = row.get("away_team", "").lower().replace(" ", "-")
        match_id = f"{home_id}-vs-{away_id}-{row.get('date', '')}"
        match = {
            "matchId": match_id,
            "competition": row.get("competition", "Imported"),
            "kickoff": row.get("date", "TBD"),
            "status": "completed",
            "homeTeam": {
                "teamId": home_id,
                "name": row.get("home_team", ""),
                "shortName": row.get("home_team", "")[:3].upper(),
                "crest": None,
            },
            "awayTeam": {
                "teamId": away_id,
                "name": row.get("away_team", ""),
                "shortName": row.get("away_team", "")[:3].upper(),
                "crest": None,
            },
            "score": {
                "home": int(row.get("home_score", 0)),
                "away": int(row.get("away_score", 0)),
            },
        }
        try:
            db.upsert_match(match)
            saved += 1
        except Exception:
            logger.warning("Failed to save match %s", match_id, exc_info=True)
    return saved


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/lineup-csv")
async def import_lineup_csv(
    file: UploadFile = File(...),
    save: bool = Query(False, description="Persist parsed data to storage."),
) -> dict[str, Any]:
    """Import a lineup CSV.

    Expected columns: ``team``, ``formation``, ``player_number``,
    ``player_name``, ``position``, ``role``, ``is_starter``.
    """
    headers, rows = await _read_csv(file)
    _validate_headers(headers, LINEUP_EXPECTED_HEADERS, "lineup-csv")

    parsed: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=2):  # line 2 is first data row
        try:
            parsed.append(
                {
                    "team": row["team"].strip(),
                    "formation": row["formation"].strip(),
                    "player_number": int(row["player_number"]),
                    "player_name": row["player_name"].strip(),
                    "position": row["position"].strip(),
                    "role": row["role"].strip(),
                    "is_starter": row["is_starter"].strip().lower() in ("true", "1", "yes"),
                }
            )
        except (KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Error parsing row {i}: {exc}",
            ) from exc

    result = _preview_response(parsed, import_type="lineup")
    if save:
        import_id = _persist_import(parsed, import_type="lineup", filename=file.filename or "unknown.csv")
        result["importId"] = import_id
        result["saved"] = True
    return result


@router.post("/player-stats-csv")
async def import_player_stats_csv(
    file: UploadFile = File(...),
    save: bool = Query(False, description="Persist parsed data to storage."),
) -> dict[str, Any]:
    """Import a player statistics CSV.

    Expected columns: ``player_name``, ``team``, ``position``,
    ``appearances``, ``goals``, ``assists``, ``xG``, ``shots``,
    ``shots_on_target``, ``minutes_played``, ``yellow_cards``,
    ``red_cards``, ``rating``.
    """
    headers, rows = await _read_csv(file)
    _validate_headers(headers, PLAYER_STATS_EXPECTED_HEADERS, "player-stats-csv")

    parsed: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=2):
        try:
            parsed.append(
                {
                    "player_name": row["player_name"].strip(),
                    "team": row["team"].strip(),
                    "position": row["position"].strip(),
                    "appearances": int(row["appearances"]),
                    "goals": int(row["goals"]),
                    "assists": int(row["assists"]),
                    "xG": float(row["xG"]),
                    "shots": int(row["shots"]),
                    "shots_on_target": int(row["shots_on_target"]),
                    "minutes_played": int(row["minutes_played"]),
                    "yellow_cards": int(row["yellow_cards"]),
                    "red_cards": int(row["red_cards"]),
                    "rating": float(row["rating"]),
                }
            )
        except (KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Error parsing row {i}: {exc}",
            ) from exc

    result = _preview_response(parsed, import_type="player-stats")
    if save:
        import_id = _persist_import(parsed, import_type="player-stats", filename=file.filename or "unknown.csv")
        result["importId"] = import_id
        result["saved"] = True
    return result


@router.post("/match-history-csv")
async def import_match_history_csv(
    file: UploadFile = File(...),
    save: bool = Query(False, description="Persist parsed data to storage."),
) -> dict[str, Any]:
    """Import a match history CSV.

    Expected columns: ``date``, ``home_team``, ``away_team``,
    ``home_score``, ``away_score``, ``competition``.
    """
    headers, rows = await _read_csv(file)
    _validate_headers(headers, MATCH_HISTORY_EXPECTED_HEADERS, "match-history-csv")

    parsed: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=2):
        try:
            parsed.append(
                {
                    "date": row["date"].strip(),
                    "home_team": row["home_team"].strip(),
                    "away_team": row["away_team"].strip(),
                    "home_score": int(row["home_score"]),
                    "away_score": int(row["away_score"]),
                    "competition": row["competition"].strip(),
                }
            )
        except (KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Error parsing row {i}: {exc}",
            ) from exc

    result = _preview_response(parsed, import_type="match-history")
    if save:
        import_id = _persist_import(parsed, import_type="match-history", filename=file.filename or "unknown.csv")
        result["importId"] = import_id
        result["saved"] = True
        # Additionally create match records in the main database
        matches_saved = _persist_match_history(parsed)
        result["matchesSaved"] = matches_saved
    return result
