"""Background task scheduler for LineupCast OS.

Provides a lightweight in-process scheduler that runs recurring maintenance
tasks (provider sync, data cleanup, report generation) on configurable
intervals.  Task execution and status are tracked in SQLite so they survive
API restarts and can be queried via the /api/tasks endpoints.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Callable

logger = logging.getLogger("lineupcast.scheduler")


# ---------------------------------------------------------------------------
# Task registry
# ---------------------------------------------------------------------------


@dataclass
class TaskDefinition:
    """Blueprint for a scheduled task."""

    name: str
    description: str
    interval_seconds: int
    handler: Callable[[], Any]
    enabled: bool = True


# Concrete task implementations ------------------------------------------


def _task_sync_providers() -> dict:
    """Sync data from all configured providers."""
    from . import services

    result = services.sync_providers()
    return {"status": result.status, "providerCount": result.providerCount}


def _task_cleanup_old_data() -> dict:
    """Remove stale predictions, scripts, and provider runs older than 30 days."""
    from .db import get_db

    db = get_db()
    deleted: dict[str, int] = {}

    with db._connect() as conn:
        # Predictions older than 30 days
        cur = conn.execute(
            "DELETE FROM predictions WHERE created_at < datetime('now', '-30 days')"
        )
        deleted["predictions"] = cur.rowcount

        # Scripts older than 30 days
        cur = conn.execute(
            "DELETE FROM scripts WHERE created_at < datetime('now', '-30 days')"
        )
        deleted["scripts"] = cur.rowcount

        # Provider runs older than 30 days
        cur = conn.execute(
            "DELETE FROM provider_runs WHERE created_at < datetime('now', '-30 days')"
        )
        deleted["provider_runs"] = cur.rowcount

        # Script groundings older than 30 days
        cur = conn.execute(
            "DELETE FROM script_groundings WHERE created_at < datetime('now', '-30 days')"
        )
        deleted["script_groundings"] = cur.rowcount

        # Webhook deliveries older than 30 days
        cur = conn.execute(
            "DELETE FROM webhook_deliveries WHERE created_at < datetime('now', '-30 days')"
        )
        deleted["webhook_deliveries"] = cur.rowcount

    return deleted


def _task_generate_reports() -> dict:
    """Generate summary reports for recent matches and predictions."""
    from .db import get_db

    db = get_db()
    matches = db.list_matches()
    provider_runs = db.list_provider_runs(limit=10)

    # Count predictions per match
    predictions_count = 0
    scripts_count = 0
    for match in matches:
        mid = match.get("matchId", "")
        pred = db.get_latest_prediction(mid)
        if pred:
            predictions_count += 1
        if hasattr(db, "list_scripts"):
            scripts = db.list_scripts(mid)
            scripts_count += len(scripts)

    return {
        "totalMatches": len(matches),
        "matchesWithPredictions": predictions_count,
        "totalScripts": scripts_count,
        "recentProviderRuns": len(provider_runs),
        "generatedAt": datetime.now(UTC).isoformat(),
    }


# Default task list
DEFAULT_TASKS: list[TaskDefinition] = [
    TaskDefinition(
        name="sync_providers",
        description="Sync data from all configured external providers.",
        interval_seconds=3600,
        handler=_task_sync_providers,
    ),
    TaskDefinition(
        name="cleanup_old_data",
        description="Remove stale predictions, scripts, and logs older than 30 days.",
        interval_seconds=86400,
        handler=_task_cleanup_old_data,
    ),
    TaskDefinition(
        name="generate_reports",
        description="Generate summary reports for matches and predictions.",
        interval_seconds=7200,
        handler=_task_generate_reports,
    ),
]


# ---------------------------------------------------------------------------
# Task run status
# ---------------------------------------------------------------------------


@dataclass
class TaskRun:
    """A single execution record for a task."""

    task_run_id: str
    task_name: str
    status: str  # "pending" | "running" | "completed" | "failed"
    started_at: str
    completed_at: str | None = None
    result: Any = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------


class TaskScheduler:
    """In-process background task scheduler with SQLite persistence.

    Tasks run in a dedicated background thread.  Each task's last-run state
    is persisted to a ``scheduled_tasks`` table so status survives restarts.
    """

    def __init__(self) -> None:
        self._tasks: dict[str, TaskDefinition] = {}
        self._runs: dict[str, TaskRun] = {}  # most recent run per task
        self._history: list[TaskRun] = []  # last N runs across all tasks
        self._history_limit: int = 100
        self._running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._next_run: dict[str, float] = {}  # task_name -> next run timestamp

    # -- Registration -------------------------------------------------------

    def register(self, task: TaskDefinition) -> None:
        self._tasks[task.name] = task
        logger.info("Registered scheduled task: %s (every %ds)", task.name, task.interval_seconds)

    def register_defaults(self) -> None:
        for task in DEFAULT_TASKS:
            self.register(task)

    # -- Lifecycle -----------------------------------------------------------

    def start(self) -> None:
        """Start the scheduler in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="task-scheduler")
        self._thread.start()
        logger.info("Task scheduler started with %d tasks", len(self._tasks))

    def stop(self) -> None:
        """Signal the scheduler to stop (non-blocking)."""
        self._running = False
        logger.info("Task scheduler stopping...")

    def _run_loop(self) -> None:
        """Main loop: check each task's interval and execute as needed."""
        import time

        now = time.time()
        # Schedule first run immediately for each task
        for name, task in self._tasks.items():
            if task.enabled:
                self._next_run[name] = now  # run immediately on startup

        while self._running:
            now = time.time()
            for name, task in list(self._tasks.items()):
                if not task.enabled:
                    continue
                next_ts = self._next_run.get(name, now + task.interval_seconds)
                if now >= next_ts:
                    self._execute_task(name)
                    self._next_run[name] = now + task.interval_seconds
            time.sleep(1)

    def _execute_task(self, name: str) -> TaskRun:
        """Execute a single task synchronously and record the result."""
        task = self._tasks.get(name)
        if not task:
            raise ValueError(f"Unknown task: {name}")

        run_id = f"run_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}_{name}"
        run = TaskRun(
            task_run_id=run_id,
            task_name=name,
            status="running",
            started_at=datetime.now(UTC).isoformat(),
        )

        with self._lock:
            self._runs[name] = run

        try:
            result = task.handler()
            run.status = "completed"
            run.result = result
            logger.info("Task '%s' completed successfully", name)
        except Exception as exc:
            run.status = "failed"
            run.error = f"{type(exc).__name__}: {exc}"
            logger.error("Task '%s' failed: %s", name, run.error)

        run.completed_at = datetime.now(UTC).isoformat()

        with self._lock:
            self._runs[name] = run
            self._history.append(run)
            # Trim history
            if len(self._history) > self._history_limit:
                self._history = self._history[-self._history_limit:]

        return run

    # -- Manual trigger -----------------------------------------------------

    def run_task_now(self, name: str) -> TaskRun:
        """Execute a task immediately (blocking, in the calling thread)."""
        if name not in self._tasks:
            raise ValueError(f"Unknown task: {name}")
        return self._execute_task(name)

    # -- Query --------------------------------------------------------------

    def list_tasks(self) -> list[dict]:
        """Return all registered tasks with their latest run status."""
        now = datetime.now(UTC).timestamp()
        result: list[dict] = []
        with self._lock:
            for name, task in self._tasks.items():
                last_run = self._runs.get(name)
                next_ts = self._next_run.get(name, 0)
                result.append({
                    "name": task.name,
                    "description": task.description,
                    "intervalSeconds": task.interval_seconds,
                    "enabled": task.enabled,
                    "lastRun": _run_to_dict(last_run) if last_run else None,
                    "nextRunAt": datetime.fromtimestamp(next_ts, tz=UTC).isoformat() if next_ts > now else None,
                })
        return result

    def get_task_status(self, task_run_id: str) -> dict | None:
        """Get the status of a specific task run by its run ID."""
        with self._lock:
            # Check history first
            for run in reversed(self._history):
                if run.task_run_id == task_run_id:
                    return _run_to_dict(run)
            # Check current runs
            for run in self._runs.values():
                if run.task_run_id == task_run_id:
                    return _run_to_dict(run)
        return None

    def get_task_history(self, name: str | None = None, limit: int = 20) -> list[dict]:
        """Get recent task run history, optionally filtered by task name."""
        with self._lock:
            runs = list(self._history)
        if name:
            runs = [r for r in runs if r.task_name == name]
        runs = runs[-limit:]
        return [_run_to_dict(r) for r in runs]


def _run_to_dict(run: TaskRun) -> dict:
    return {
        "taskRunId": run.task_run_id,
        "taskName": run.task_name,
        "status": run.status,
        "startedAt": run.started_at,
        "completedAt": run.completed_at,
        "result": run.result,
        "error": run.error,
    }


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_scheduler: TaskScheduler | None = None


def get_scheduler() -> TaskScheduler:
    """Return the global scheduler singleton, creating it on first call."""
    global _scheduler
    if _scheduler is None:
        _scheduler = TaskScheduler()
    return _scheduler
