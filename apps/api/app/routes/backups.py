"""Backup management routes for LineupCast API.

Provides endpoints to list, create, restore, and download database backups.
Backups are stored as JSON files in ``data/backups/``.
"""

from __future__ import annotations

import json
import logging
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..db import get_db

router = APIRouter(prefix="/api/backups", tags=["backups"])

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "backups"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class BackupInfo(BaseModel):
    backupId: str
    description: str
    sizeBytes: int
    tableCounts: dict[str, int] = Field(default_factory=dict)
    createdAt: str


class BackupListResponse(BaseModel):
    backups: list[BackupInfo]
    total: int


class BackupCreateRequest(BaseModel):
    description: str = ""


class BackupCreateResponse(BaseModel):
    backupId: str
    description: str
    sizeBytes: int
    tableCounts: dict[str, int]
    createdAt: str


class BackupRestoreResponse(BaseModel):
    backupId: str
    restoredAt: str
    tableCounts: dict[str, int]
    status: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _backup_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def _list_backup_files() -> list[Path]:
    return sorted(_backup_dir().glob("*.json"), reverse=True)


def _read_backup_meta(path: Path) -> BackupInfo | None:
    """Read metadata from a backup file header without loading all rows."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return BackupInfo(
            backupId=data.get("backupId", path.stem),
            description=data.get("description", ""),
            sizeBytes=path.stat().st_size,
            tableCounts=data.get("tableCounts", {}),
            createdAt=data.get("createdAt", ""),
        )
    except Exception:
        return None


def _dump_table(db: Any, table: str) -> list[dict[str, Any]]:
    """Dump all rows from a table as a list of dicts."""
    try:
        with db._conn() as conn:  # noqa: SLF001
            cursor = conn.execute(f"SELECT * FROM {table}")
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    except Exception:
        return []


def _count_table(db: Any, table: str) -> int:
    try:
        with db._conn() as conn:  # noqa: SLF001
            cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
            return cursor.fetchone()[0]
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=BackupListResponse)
async def list_backups() -> BackupListResponse:
    """List all available backups."""
    files = _list_backup_files()
    backups: list[BackupInfo] = []
    for path in files:
        meta = _read_backup_meta(path)
        if meta:
            backups.append(meta)
    return BackupListResponse(backups=backups, total=len(backups))


@router.post("", response_model=BackupCreateResponse)
async def create_backup(
    payload: BackupCreateRequest | None = None,
) -> BackupCreateResponse:
    """Create a new backup of the current database."""
    db = get_db()
    description = (payload.description if payload else "") or f"Backup {_now_iso()}"

    tables = ["matches", "scripts", "predictions"]
    backup_data: dict[str, Any] = {
        "backupId": f"bak_{uuid4().hex[:12]}",
        "description": description,
        "createdAt": _now_iso(),
        "tableCounts": {},
        "tables": {},
    }

    for table in tables:
        rows = _dump_table(db, table)
        backup_data["tables"][table] = rows
        backup_data["tableCounts"][table] = len(rows)

    path = _backup_dir() / f"{backup_data['backupId']}.json"
    path.write_text(json.dumps(backup_data, ensure_ascii=False, indent=2, default=str))
    size_bytes = path.stat().st_size

    logger.info(
        "Created backup %s (%d bytes, tables: %s)",
        backup_data["backupId"],
        size_bytes,
        backup_data["tableCounts"],
    )

    return BackupCreateResponse(
        backupId=backup_data["backupId"],
        description=description,
        sizeBytes=size_bytes,
        tableCounts=backup_data["tableCounts"],
        createdAt=backup_data["createdAt"],
    )


@router.post("/{backup_id}/restore", response_model=BackupRestoreResponse)
async def restore_backup(backup_id: str) -> BackupRestoreResponse:
    """Restore the database from a specific backup."""
    path = _backup_dir() / f"{backup_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Backup '{backup_id}' not found.")

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to read backup file: {exc}"
        ) from exc

    db = get_db()
    tables = data.get("tables", {})
    restored_counts: dict[str, int] = {}

    for table_name, rows in tables.items():
        if not rows:
            restored_counts[table_name] = 0
            continue

        try:
            with db._conn() as conn:  # noqa: SLF001
                # Clear existing data
                conn.execute(f"DELETE FROM {table_name}")

                # Insert rows
                columns = list(rows[0].keys())
                placeholders = ", ".join(["?"] * len(columns))
                col_names = ", ".join(columns)

                for row in rows:
                    values = [row.get(col) for col in columns]
                    # Serialize dicts/lists to JSON strings for storage
                    values = [
                        json.dumps(v, ensure_ascii=False, default=str)
                        if isinstance(v, (dict, list))
                        else v
                        for v in values
                    ]
                    conn.execute(
                        f"INSERT OR REPLACE INTO {table_name} ({col_names}) VALUES ({placeholders})",
                        values,
                    )

                conn.commit()
            restored_counts[table_name] = len(rows)
        except Exception as exc:
            logger.warning("Failed to restore table %s: %s", table_name, exc)
            restored_counts[table_name] = 0

    logger.info("Restored backup %s: %s", backup_id, restored_counts)

    return BackupRestoreResponse(
        backupId=backup_id,
        restoredAt=_now_iso(),
        tableCounts=restored_counts,
        status="restored",
    )


@router.get("/{backup_id}/download")
async def download_backup(backup_id: str) -> Response:
    """Download a backup file as JSON."""
    path = _backup_dir() / f"{backup_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Backup '{backup_id}' not found.")

    content = path.read_bytes()
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{backup_id}.json"',
        },
    )
