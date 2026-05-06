"""Bridge to call the TypeScript @lineupcast/ai-script package from Python.

Spins up a short-lived Node.js subprocess that imports the compiled
``generateScript`` function and pipes JSON through stdin/stdout.
"""

from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_SCRIPT_PATH = (
    Path(__file__).resolve().parent.parent / "scripts" / "generate-script.mjs"
)


def call_script_generator(script_input: dict[str, Any]) -> dict[str, Any] | None:
    """Call the TypeScript ``generateScript()`` via a Node subprocess.

    Parameters
    ----------
    script_input:
        A dict that conforms to the ``ScriptGenerationInput`` TypeScript
        interface (match, lineups, prediction, goalScorers, cardRisks,
        style, duration, language).

    Returns
    -------
    dict or None
        The ``ScriptGenerationOutput`` dict on success, or ``None`` on
        any failure (missing node, timeout, non-zero exit, parse error).
    """
    # ── Serialize input ──────────────────────────────────────────────────
    try:
        payload = json.dumps(script_input, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        logger.warning("script_bridge: failed to serialize input: %s", exc)
        return None

    # ── Run Node subprocess ──────────────────────────────────────────────
    try:
        result = subprocess.run(
            ["node", str(_SCRIPT_PATH)],
            input=payload,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except FileNotFoundError:
        logger.warning("script_bridge: 'node' executable not found on PATH")
        return None
    except subprocess.TimeoutExpired:
        logger.warning("script_bridge: node process timed out (15 s)")
        return None

    if result.returncode != 0:
        stderr = result.stderr.strip()
        logger.warning(
            "script_bridge: node exited with code %d: %s",
            result.returncode,
            stderr,
        )
        return None

    # ── Parse output ─────────────────────────────────────────────────────
    try:
        return json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("script_bridge: failed to parse node stdout: %s", exc)
        return None
