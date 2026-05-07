"""SQLite-based persistent storage for LineupCast API.

Uses WAL mode for concurrent access and context managers for all
connections.  Tables are auto-created on first use.

Data directory: ``apps/api/data/lineupcast.db``
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Generator
from uuid import uuid4

# ---------------------------------------------------------------------------
# Schema version & migrations
# ---------------------------------------------------------------------------

SCHEMA_VERSION = 2

MIGRATIONS: dict[int, str] = {
    1: """
    CREATE TABLE IF NOT EXISTS matches (
        match_id    TEXT PRIMARY KEY,
        competition TEXT NOT NULL DEFAULT 'Imported Friendly',
        kickoff     TEXT NOT NULL DEFAULT 'TBD',
        status      TEXT NOT NULL DEFAULT 'scheduled',
        home_team_id        TEXT NOT NULL,
        home_team_name      TEXT NOT NULL,
        home_team_short_name TEXT NOT NULL,
        home_team_crest     TEXT,
        away_team_id        TEXT NOT NULL,
        away_team_name      TEXT NOT NULL,
        away_team_short_name TEXT NOT NULL,
        away_team_crest     TEXT,
        score_home  INTEGER,
        score_away  INTEGER,
        data        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scripts (
        script_id    TEXT PRIMARY KEY,
        match_id     TEXT NOT NULL,
        language     TEXT NOT NULL,
        title        TEXT NOT NULL,
        script       TEXT NOT NULL,
        provider     TEXT NOT NULL,
        model        TEXT NOT NULL,
        latency_ms   INTEGER NOT NULL DEFAULT 0,
        fallback     INTEGER NOT NULL DEFAULT 0,
        status       TEXT NOT NULL DEFAULT 'generated',
        generated_at TEXT NOT NULL,
        disclaimer   TEXT NOT NULL DEFAULT '',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );

    CREATE TABLE IF NOT EXISTS predictions (
        prediction_id   TEXT PRIMARY KEY,
        match_id        TEXT NOT NULL,
        home_win        INTEGER NOT NULL,
        draw            INTEGER NOT NULL,
        away_win        INTEGER NOT NULL,
        expected_home_goals REAL NOT NULL,
        expected_away_goals REAL NOT NULL,
        model_name      TEXT NOT NULL,
        model_version   TEXT NOT NULL,
        confidence      REAL NOT NULL,
        data            TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );

    CREATE TABLE IF NOT EXISTS provider_runs (
        run_id      TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'synced',
        provider_count INTEGER NOT NULL DEFAULT 0,
        synced_at   TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prediction_records (
        record_id       TEXT PRIMARY KEY,
        match_id        TEXT NOT NULL,
        prediction_id   TEXT,
        prediction_data TEXT NOT NULL,
        actual_result   TEXT,
        notes           TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );

    CREATE TABLE IF NOT EXISTS _migrations (
        version     INTEGER PRIMARY KEY,
        applied_at  TEXT NOT NULL
    );
    """,
    2: """
    CREATE TABLE IF NOT EXISTS overlay_exports (
        export_id   TEXT PRIMARY KEY,
        match_id    TEXT NOT NULL,
        scene_type  TEXT NOT NULL,
        format      TEXT NOT NULL,
        url         TEXT,
        exported_at TEXT NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );

    CREATE INDEX IF NOT EXISTS idx_overlay_exports_match_id ON overlay_exports(match_id);
    CREATE INDEX IF NOT EXISTS idx_overlay_exports_exported_at ON overlay_exports(exported_at);
    """,
}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class Database:
    """SQLite-backed storage with WAL mode and auto-migration."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._run_migrations()

    # ------------------------------------------------------------------
    # Connection helpers
    # ------------------------------------------------------------------

    @contextmanager
    def _connect(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(str(self._db_path), timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Migrations
    # ------------------------------------------------------------------

    def _run_migrations(self) -> None:
        with self._connect() as conn:
            # Ensure _migrations table exists (created by version 1 migration)
            conn.execute(
                "CREATE TABLE IF NOT EXISTS _migrations "
                "(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
            )
            applied = {
                row["version"]
                for row in conn.execute("SELECT version FROM _migrations").fetchall()
            }
            for version in sorted(MIGRATIONS):
                if version not in applied:
                    conn.executescript(MIGRATIONS[version])
                    conn.execute(
                        "INSERT INTO _migrations (version, applied_at) VALUES (?, ?)",
                        (version, _now_iso()),
                    )

    # ------------------------------------------------------------------
    # Matches CRUD
    # ------------------------------------------------------------------

    def get_match(self, match_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM matches WHERE match_id = ?", (match_id,)
            ).fetchone()
            if row is None:
                return None
            return json.loads(row["data"])

    def list_matches(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT data FROM matches ORDER BY created_at DESC"
            ).fetchall()
            return [json.loads(row["data"]) for row in rows]

    def upsert_match(self, match: dict) -> dict:
        match_id = match["matchId"]
        score = match.get("score") or {}
        now = _now_iso()

        with self._connect() as conn:
            existing = conn.execute(
                "SELECT match_id FROM matches WHERE match_id = ?", (match_id,)
            ).fetchone()

            if existing:
                conn.execute(
                    """
                    UPDATE matches SET
                        competition = ?,
                        kickoff = ?,
                        status = ?,
                        home_team_id = ?,
                        home_team_name = ?,
                        home_team_short_name = ?,
                        home_team_crest = ?,
                        away_team_id = ?,
                        away_team_name = ?,
                        away_team_short_name = ?,
                        away_team_crest = ?,
                        score_home = ?,
                        score_away = ?,
                        data = ?,
                        updated_at = ?
                    WHERE match_id = ?
                    """,
                    (
                        match.get("competition", ""),
                        match.get("kickoff", ""),
                        match.get("status", "scheduled"),
                        match.get("homeTeam", {}).get("teamId", ""),
                        match.get("homeTeam", {}).get("name", ""),
                        match.get("homeTeam", {}).get("shortName", ""),
                        match.get("homeTeam", {}).get("crest"),
                        match.get("awayTeam", {}).get("teamId", ""),
                        match.get("awayTeam", {}).get("name", ""),
                        match.get("awayTeam", {}).get("shortName", ""),
                        match.get("awayTeam", {}).get("crest"),
                        score.get("home"),
                        score.get("away"),
                        json.dumps(match),
                        now,
                        match_id,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO matches (
                        match_id, competition, kickoff, status,
                        home_team_id, home_team_name, home_team_short_name, home_team_crest,
                        away_team_id, away_team_name, away_team_short_name, away_team_crest,
                        score_home, score_away, data, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        match_id,
                        match.get("competition", ""),
                        match.get("kickoff", ""),
                        match.get("status", "scheduled"),
                        match.get("homeTeam", {}).get("teamId", ""),
                        match.get("homeTeam", {}).get("name", ""),
                        match.get("homeTeam", {}).get("shortName", ""),
                        match.get("homeTeam", {}).get("crest"),
                        match.get("awayTeam", {}).get("teamId", ""),
                        match.get("awayTeam", {}).get("name", ""),
                        match.get("awayTeam", {}).get("shortName", ""),
                        match.get("awayTeam", {}).get("crest"),
                        score.get("home"),
                        score.get("away"),
                        json.dumps(match),
                        now,
                        now,
                    ),
                )
        return match

    def match_exists(self, match_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT 1 FROM matches WHERE match_id = ?", (match_id,)
            ).fetchone()
            return row is not None

    def delete_match(self, match_id: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM matches WHERE match_id = ?", (match_id,)
            )
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Scripts CRUD
    # ------------------------------------------------------------------

    def get_script(self, script_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM scripts WHERE script_id = ?", (script_id,)
            ).fetchone()
            if row is None:
                return None
            return self._row_to_script(row)

    def list_scripts(self, match_id: str) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scripts WHERE match_id = ? ORDER BY generated_at DESC",
                (match_id,),
            ).fetchall()
            return [self._row_to_script(row) for row in rows]

    def save_script(self, script: dict) -> dict:
        now = _now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO scripts (
                    script_id, match_id, language, title, script, provider,
                    model, latency_ms, fallback, status, generated_at,
                    disclaimer, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    script["scriptId"],
                    script["matchId"],
                    script["language"],
                    script["title"],
                    script["script"],
                    script["provider"],
                    script["model"],
                    script["latencyMs"],
                    1 if script.get("fallback") else 0,
                    script.get("status", "generated"),
                    (
                        script["generatedAt"].isoformat()
                        if hasattr(script["generatedAt"], "isoformat")
                        else str(script["generatedAt"])
                    ),
                    script.get("disclaimer", ""),
                    now,
                    now,
                ),
            )
        return script

    @staticmethod
    def _row_to_script(row: sqlite3.Row) -> dict:
        return {
            "scriptId": row["script_id"],
            "matchId": row["match_id"],
            "language": row["language"],
            "title": row["title"],
            "script": row["script"],
            "provider": row["provider"],
            "model": row["model"],
            "latencyMs": row["latency_ms"],
            "fallback": bool(row["fallback"]),
            "status": row["status"],
            "generatedAt": row["generated_at"],
            "disclaimer": row["disclaimer"],
        }

    # ------------------------------------------------------------------
    # Predictions CRUD
    # ------------------------------------------------------------------

    def get_prediction(self, prediction_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM predictions WHERE prediction_id = ?",
                (prediction_id,),
            ).fetchone()
            if row is None:
                return None
            return json.loads(row["data"])

    def get_latest_prediction(self, match_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT data FROM predictions WHERE match_id = ? "
                "ORDER BY created_at DESC LIMIT 1",
                (match_id,),
            ).fetchone()
            if row is None:
                return None
            return json.loads(row["data"])

    def save_prediction(self, prediction: dict) -> dict:
        prediction_id = f"pred_{uuid4().hex[:12]}"
        now = _now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO predictions (
                    prediction_id, match_id, home_win, draw, away_win,
                    expected_home_goals, expected_away_goals,
                    model_name, model_version, confidence,
                    data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    prediction_id,
                    prediction.get("matchId", ""),
                    prediction.get("homeWin", 0),
                    prediction.get("draw", 0),
                    prediction.get("awayWin", 0),
                    prediction.get("expectedHomeGoals", 0.0),
                    prediction.get("expectedAwayGoals", 0.0),
                    prediction.get("modelName", ""),
                    prediction.get("modelVersion", ""),
                    prediction.get("confidence", 0.0),
                    json.dumps(prediction, default=str),
                    now,
                    now,
                ),
            )
        return prediction

    # ------------------------------------------------------------------
    # Provider runs CRUD
    # ------------------------------------------------------------------

    def save_provider_run(
        self,
        provider_id: str,
        status: str = "synced",
        provider_count: int = 0,
    ) -> dict:
        run_id = f"run_{uuid4().hex[:12]}"
        now = _now_iso()
        run = {
            "runId": run_id,
            "providerId": provider_id,
            "status": status,
            "providerCount": provider_count,
            "syncedAt": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO provider_runs (
                    run_id, provider_id, status, provider_count,
                    synced_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (run_id, provider_id, status, provider_count, now, now, now),
            )
        return run

    def list_provider_runs(self, limit: int = 50) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM provider_runs ORDER BY synced_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [
                {
                    "runId": row["run_id"],
                    "providerId": row["provider_id"],
                    "status": row["status"],
                    "providerCount": row["provider_count"],
                    "syncedAt": row["synced_at"],
                }
                for row in rows
            ]

    # ------------------------------------------------------------------
    # Prediction records CRUD
    # ------------------------------------------------------------------

    def save_prediction_record(
        self,
        match_id: str,
        prediction_data: dict,
        actual_result: dict | None = None,
        notes: str | None = None,
    ) -> dict:
        record_id = f"rec_{uuid4().hex[:12]}"
        now = _now_iso()
        record = {
            "recordId": record_id,
            "matchId": match_id,
            "predictionData": prediction_data,
            "actualResult": actual_result,
            "notes": notes,
            "createdAt": now,
            "updatedAt": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO prediction_records (
                    record_id, match_id, prediction_id, prediction_data,
                    actual_result, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    match_id,
                    prediction_data.get("predictionId"),
                    json.dumps(prediction_data, default=str),
                    json.dumps(actual_result, default=str) if actual_result else None,
                    notes,
                    now,
                    now,
                ),
            )
        return record

    def list_prediction_records(
        self, match_id: str | None = None, limit: int = 100
    ) -> list[dict]:
        with self._connect() as conn:
            if match_id:
                rows = conn.execute(
                    "SELECT * FROM prediction_records WHERE match_id = ? "
                    "ORDER BY created_at DESC LIMIT ?",
                    (match_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM prediction_records ORDER BY created_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            return [
                {
                    "recordId": row["record_id"],
                    "matchId": row["match_id"],
                    "predictionData": json.loads(row["prediction_data"]),
                    "actualResult": (
                        json.loads(row["actual_result"])
                        if row["actual_result"]
                        else None
                    ),
                    "notes": row["notes"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in rows
            ]

    def get_prediction_record(self, record_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM prediction_records WHERE record_id = ?",
                (record_id,),
            ).fetchone()
            if row is None:
                return None
            return {
                "recordId": row["record_id"],
                "matchId": row["match_id"],
                "predictionData": json.loads(row["prediction_data"]),
                "actualResult": (
                    json.loads(row["actual_result"])
                    if row["actual_result"]
                    else None
                ),
                "notes": row["notes"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }

    def update_prediction_record(
        self,
        record_id: str,
        actual_result: dict | None = None,
        notes: str | None = None,
    ) -> bool:
        now = _now_iso()
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT record_id FROM prediction_records WHERE record_id = ?",
                (record_id,),
            ).fetchone()
            if existing is None:
                return False

            updates: list[str] = ["updated_at = ?"]
            params: list[Any] = [now]

            if actual_result is not None:
                updates.append("actual_result = ?")
                params.append(json.dumps(actual_result, default=str))
            if notes is not None:
                updates.append("notes = ?")
                params.append(notes)

            params.append(record_id)
            conn.execute(
                f"UPDATE prediction_records SET {', '.join(updates)} WHERE record_id = ?",
                params,
            )
            return True

    # ------------------------------------------------------------------
    # Scripts helper: list across all matches
    # ------------------------------------------------------------------

    def list_all_scripts(self, limit: int = 500) -> list[dict]:
        """List scripts across all matches, ordered by most recent first."""
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM scripts ORDER BY generated_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [self._row_to_script(row) for row in rows]

    # ------------------------------------------------------------------
    # Overlay exports CRUD
    # ------------------------------------------------------------------

    def save_overlay_export(
        self,
        match_id: str,
        scene_type: str,
        format: str = "svg",
        url: str | None = None,
    ) -> dict:
        export_id = f"exp_{uuid4().hex[:12]}"
        now = _now_iso()
        record = {
            "exportId": export_id,
            "matchId": match_id,
            "sceneType": scene_type,
            "format": format,
            "url": url,
            "exportedAt": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO overlay_exports (
                    export_id, match_id, scene_type, format, url, exported_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (export_id, match_id, scene_type, format, url, now),
            )
        return record

    def get_overlay_export(self, export_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM overlay_exports WHERE export_id = ?",
                (export_id,),
            ).fetchone()
            if row is None:
                return None
            return {
                "exportId": row["export_id"],
                "matchId": row["match_id"],
                "sceneType": row["scene_type"],
                "format": row["format"],
                "url": row["url"],
                "exportedAt": row["exported_at"],
            }

    def list_overlay_exports(
        self, match_id: str | None = None, limit: int = 100
    ) -> list[dict]:
        with self._connect() as conn:
            if match_id:
                rows = conn.execute(
                    "SELECT * FROM overlay_exports WHERE match_id = ? "
                    "ORDER BY exported_at DESC LIMIT ?",
                    (match_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM overlay_exports ORDER BY exported_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
            return [
                {
                    "exportId": row["export_id"],
                    "matchId": row["match_id"],
                    "sceneType": row["scene_type"],
                    "format": row["format"],
                    "url": row["url"],
                    "exportedAt": row["exported_at"],
                }
                for row in rows
            ]


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_db_instance: Database | None = None


def get_db(db_path: str | Path | None = None) -> Database:
    """Return the singleton ``Database`` instance.

    On first call, *db_path* (or a sensible default) is used.
    Subsequent calls ignore *db_path* and return the same instance.
    """
    global _db_instance
    if _db_instance is None:
        if db_path is None:
            default = Path(__file__).resolve().parent.parent / "data" / "lineupcast.db"
            db_path = default
        _db_instance = Database(db_path)
    return _db_instance


def reset_db() -> None:
    """Reset the singleton (useful for testing)."""
    global _db_instance
    _db_instance = None
