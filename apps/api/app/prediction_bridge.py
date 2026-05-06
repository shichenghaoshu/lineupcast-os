"""Bridge to call @lineupcast/prediction via Node.js subprocess."""

from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SCRIPT_PATH = Path(__file__).parent.parent / "scripts" / "predict.mjs"


def call_prediction_engine(match_data: dict[str, Any]) -> dict[str, Any] | None:
    """Call the TypeScript prediction engine via subprocess.

    Returns prediction dict on success, None on failure.
    Falls back to mock data in the caller.
    """
    if not SCRIPT_PATH.exists():
        logger.warning("Prediction bridge script not found: %s", SCRIPT_PATH)
        return None

    try:
        result = subprocess.run(
            ["node", str(SCRIPT_PATH)],
            input=json.dumps(match_data),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            logger.warning("Prediction bridge failed: %s", result.stderr)
            return None

        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError) as exc:
        logger.warning("Prediction bridge error: %s", exc)
        return None
