"""Scheduled task management routes.

Provides endpoints to list scheduled tasks, trigger manual runs,
and inspect the status / history of task executions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..scheduler import get_scheduler
from ..security import require_admin

router = APIRouter(tags=["tasks"])


@router.get("/api/tasks")
async def list_tasks() -> dict:
    """List all registered scheduled tasks with their current status."""
    scheduler = get_scheduler()
    tasks = scheduler.list_tasks()
    return {"tasks": tasks, "total": len(tasks)}


@router.post(
    "/api/tasks/{task_name}/run",
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_task(
    task_name: str,
    _: dict = Depends(require_admin),
) -> dict:
    """Trigger a task to run immediately (admin only).

    Returns the task run record once execution finishes.
    """
    scheduler = get_scheduler()
    try:
        run = scheduler.run_task_now(task_name)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_name}' not found",
        )
    return {
        "taskRunId": run.task_run_id,
        "taskName": run.task_name,
        "status": run.status,
        "startedAt": run.started_at,
        "completedAt": run.completed_at,
        "result": run.result,
        "error": run.error,
    }


@router.get("/api/tasks/{task_run_id}/status")
async def get_task_status(task_run_id: str) -> dict:
    """Get the status of a specific task run by its run ID."""
    scheduler = get_scheduler()
    result = scheduler.get_task_status(task_run_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task run '{task_run_id}' not found",
        )
    return result


@router.get("/api/tasks/history")
async def get_task_history(
    name: str | None = Query(None, description="Filter by task name"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
) -> dict:
    """Get recent task execution history, optionally filtered by task name."""
    scheduler = get_scheduler()
    history = scheduler.get_task_history(name=name, limit=limit)
    return {"runs": history, "total": len(history)}
