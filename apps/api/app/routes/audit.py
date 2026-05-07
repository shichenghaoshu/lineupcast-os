"""Audit log API routes.

Provides:
- GET /api/audit-logs        -- paginated list with optional filters
- GET /api/audit-logs/export -- CSV export of (optionally filtered) logs
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_session
from ..models import AuditLog
from ..security import require_admin
from ..config import Settings

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def _serialize(log: AuditLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "user": log.user,
        "action": log.action,
        "resourceType": log.resource_type,
        "resourceId": log.resource_id,
        "detail": log.detail,
        "ipAddress": log.ip_address,
        "meta": log.meta,
    }


def _build_query(
    session: Session,
    *,
    user: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    """Build a filtered query on AuditLog."""
    stmt = select(AuditLog)

    if user:
        stmt = stmt.where(AuditLog.user.ilike(f"%{user}%"))
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            stmt = stmt.where(AuditLog.timestamp >= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_from format: {date_from}")
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            stmt = stmt.where(AuditLog.timestamp <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_to format: {date_to}")

    return stmt


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    user: Optional[str] = Query(None, description="Filter by user (partial match)"),
    action: Optional[str] = Query(None, description="Filter by exact action"),
    resource_type: Optional[str] = Query(None, description="Filter by exact resource type"),
    date_from: Optional[str] = Query(None, description="ISO date lower bound"),
    date_to: Optional[str] = Query(None, description="ISO date upper bound"),
) -> dict[str, Any]:
    """Return a paginated, filtered list of audit log entries."""
    with get_session() as session:
        base = _build_query(
            session,
            user=user,
            action=action,
            resource_type=resource_type,
            date_from=date_from,
            date_to=date_to,
        )

        # Total count for pagination
        count_stmt = select(func.count()).select_from(base.subquery())
        total = session.execute(count_stmt).scalar_one()

        # Apply ordering and pagination
        offset = (page - 1) * page_size
        stmt = base.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size)
        rows = session.execute(stmt).scalars().all()

    return {
        "items": [_serialize(r) for r in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, -(-total // page_size)),  # ceiling division
    }


@router.get("/export")
async def export_audit_logs(
    user: Optional[str] = Query(None, description="Filter by user (partial match)"),
    action: Optional[str] = Query(None, description="Filter by exact action"),
    resource_type: Optional[str] = Query(None, description="Filter by exact resource type"),
    date_from: Optional[str] = Query(None, description="ISO date lower bound"),
    date_to: Optional[str] = Query(None, description="ISO date upper bound"),
) -> StreamingResponse:
    """Export audit logs as a CSV file download."""
    with get_session() as session:
        stmt = _build_query(
            session,
            user=user,
            action=action,
            resource_type=resource_type,
            date_from=date_from,
            date_to=date_to,
        ).order_by(AuditLog.timestamp.desc())
        rows = session.execute(stmt).scalars().all()

    # Build CSV in memory
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "timestamp", "user", "action",
        "resource_type", "resource_id", "detail",
        "ip_address", "meta",
    ])
    for r in rows:
        writer.writerow([
            r.id,
            r.timestamp.isoformat() if r.timestamp else "",
            r.user or "",
            r.action,
            r.resource_type,
            r.resource_id or "",
            r.detail or "",
            r.ip_address or "",
            str(r.meta) if r.meta else "",
        ])

    buf.seek(0)
    filename = f"audit-logs-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
