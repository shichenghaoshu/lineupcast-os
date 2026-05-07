"""Data export routes for LineupCast API.

Provides endpoints for exporting predictions, scripts, overlays,
and full backups in CSV, JSON, and ZIP formats.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import zipfile
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse

from ..db import get_db
from ..security import require_admin

router = APIRouter(prefix="/api/export", tags=["export"])

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OVERLAY_SCENES = [
    {"type": "lineup_16x9", "name": "Lineup Graphic (16:9)", "width": 1920, "height": 1080},
    {"type": "lineup_9x16", "name": "Lineup Graphic (9:16)", "width": 1080, "height": 1920},
    {"type": "prediction_strip", "name": "Prediction Probability Strip", "width": 600, "height": 60},
    {"type": "lower_third", "name": "Player Lower-Third", "width": 800, "height": 100},
    {"type": "discipline_risk_16x9", "name": "Discipline Risk Alert (16:9)", "width": 1920, "height": 1080},
]

DISCLAIMER = "For commentary assistance, not betting advice."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _now_ts() -> str:
    return datetime.now(UTC).strftime("%Y%m%d_%H%M%S")


def _build_csv(rows: list[dict[str, Any]], columns: list[str]) -> str:
    """Build a CSV string from a list of dicts with explicit column order."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()


def _flatten_prediction(record: dict[str, Any]) -> dict[str, Any]:
    """Flatten a prediction record for CSV export."""
    data = record.get("predictionData", {})
    return {
        "recordId": record.get("recordId", ""),
        "matchId": record.get("matchId", ""),
        "homeWin": data.get("homeWin", ""),
        "draw": data.get("draw", ""),
        "awayWin": data.get("awayWin", ""),
        "expectedHomeGoals": data.get("expectedHomeGoals", ""),
        "expectedAwayGoals": data.get("expectedAwayGoals", ""),
        "confidence": data.get("confidence", ""),
        "modelName": data.get("modelName", ""),
        "notes": record.get("notes", ""),
        "createdAt": record.get("createdAt", ""),
    }


def _generate_placeholder_svg(
    scene_type: str, match_id: str, width: int, height: int
) -> str:
    """Generate a placeholder SVG for a given scene type."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <rect width="{width}" height="{height}" fill="#0d1117" rx="0"/>
  <text x="{width / 2}" y="{height / 2 - 20}" text-anchor="middle" font-size="24" fill="#888" font-family="system-ui,sans-serif">{scene_type}</text>
  <text x="{width / 2}" y="{height / 2 + 20}" text-anchor="middle" font-size="16" fill="#555" font-family="system-ui,sans-serif">Match: {match_id}</text>
  <text x="{width / 2}" y="{height / 2 + 50}" text-anchor="middle" font-size="12" fill="#444" font-family="system-ui,sans-serif">{DISCLAIMER}</text>
</svg>"""


def _wrap_svg_html(svg: str, width: int, height: int) -> str:
    """Wrap an SVG string in a standalone HTML document."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width={width}, height={height}, initial-scale=1.0">
  <title>LineupCast Overlay</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ overflow: hidden; background: transparent; width: {width}px; height: {height}px; }}
  </style>
</head>
<body>
  {svg}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/predictions")
async def export_predictions_csv(
    match_id: str | None = Query(None, description="Filter by match ID"),
    limit: int = Query(500, ge=1, le=5000),
    _: Any = Depends(require_admin),
) -> Response:
    """Export predictions as a CSV file.

    Returns all prediction records (optionally filtered by match_id)
    with key fields flattened into CSV columns.
    """
    db = get_db()
    records = db.list_prediction_records(match_id=match_id, limit=limit)

    if not records:
        raise HTTPException(status_code=404, detail="No predictions found to export.")

    columns = [
        "recordId",
        "matchId",
        "homeWin",
        "draw",
        "awayWin",
        "expectedHomeGoals",
        "expectedAwayGoals",
        "confidence",
        "modelName",
        "notes",
        "createdAt",
    ]
    rows = [_flatten_prediction(r) for r in records]
    csv_content = _build_csv(rows, columns)

    filename = f"lineupcast_predictions_{_now_ts()}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/scripts")
async def export_scripts_json(
    match_id: str | None = Query(None, description="Filter by match ID"),
    limit: int = Query(200, ge=1, le=2000),
    _: Any = Depends(require_admin),
) -> Response:
    """Export scripts as a JSON file.

    Returns all generated scripts (optionally filtered by match_id)
    with full text and metadata.
    """
    db = get_db()

    if match_id:
        scripts = db.list_scripts(match_id)
    else:
        scripts = db.list_all_scripts(limit=limit)

    scripts = scripts[:limit]

    if not scripts:
        raise HTTPException(status_code=404, detail="No scripts found to export.")

    payload = {
        "exportType": "scripts",
        "exportedAt": _now_iso(),
        "totalScripts": len(scripts),
        "scripts": scripts,
    }

    json_content = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    filename = f"lineupcast_scripts_{_now_ts()}.json"
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/overlays")
async def export_overlays_zip(
    match_id: str = Query("demo-manchester-red-vs-shanghai-harbor", description="Match ID for overlay generation"),
    _: Any = Depends(require_admin),
) -> StreamingResponse:
    """Export overlays as a ZIP file.

    Generates a set of overlay scenes for the specified match and
    packages them as individual HTML files inside a ZIP archive
    with a JSON manifest.
    """
    db = get_db()
    match = db.get_match(match_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Write manifest
        manifest = {
            "exportType": "overlays",
            "matchId": match_id,
            "exportedAt": _now_iso(),
            "totalScenes": len(OVERLAY_SCENES),
            "scenes": OVERLAY_SCENES,
            "disclaimer": DISCLAIMER,
        }
        zf.writestr(
            "manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2, default=str),
        )

        # Generate and write individual overlay HTML files
        for scene in OVERLAY_SCENES:
            scene_type = scene["type"]
            width = scene["width"]
            height = scene["height"]

            svg = _generate_placeholder_svg(scene_type, match_id, width, height)
            html = _wrap_svg_html(svg, width, height)

            # Save export record in DB
            record = db.save_overlay_export(
                match_id=match_id,
                scene_type=scene_type,
                format="html",
            )

            zf.writestr(f"overlays/{record['exportId']}.html", html)

    buf.seek(0)
    filename = f"lineupcast_overlays_{_now_ts()}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/full")
async def export_full_backup(
    _: Any = Depends(require_admin),
) -> StreamingResponse:
    """Export a full backup ZIP of all LineupCast data.

    Includes:
    - matches.json: all match records
    - predictions.csv: all prediction records
    - scripts.json: all scripts
    - overlays/: generated overlay HTML files
    - backup_meta.json: export metadata
    """
    db = get_db()

    # Gather all data
    matches = db.list_matches()
    prediction_records = db.list_prediction_records(limit=5000)
    all_scripts = db.list_all_scripts(limit=5000)
    overlay_exports = db.list_overlay_exports(limit=5000)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Backup metadata
        meta = {
            "exportType": "full_backup",
            "exportedAt": _now_iso(),
            "matchCount": len(matches),
            "predictionCount": len(prediction_records),
            "scriptCount": len(all_scripts),
            "overlayCount": len(overlay_exports),
        }
        zf.writestr(
            "backup_meta.json",
            json.dumps(meta, ensure_ascii=False, indent=2),
        )

        # Matches
        zf.writestr(
            "matches.json",
            json.dumps(matches, ensure_ascii=False, indent=2, default=str),
        )

        # Predictions as CSV
        pred_columns = [
            "recordId",
            "matchId",
            "homeWin",
            "draw",
            "awayWin",
            "expectedHomeGoals",
            "expectedAwayGoals",
            "confidence",
            "modelName",
            "notes",
            "createdAt",
        ]
        pred_rows = [_flatten_prediction(r) for r in prediction_records]
        zf.writestr("predictions.csv", _build_csv(pred_rows, pred_columns))

        # Scripts as JSON
        zf.writestr(
            "scripts.json",
            json.dumps(all_scripts, ensure_ascii=False, indent=2, default=str),
        )

        # Overlay manifest
        overlay_manifest = {
            "exportedAt": _now_iso(),
            "totalOverlays": len(overlay_exports),
            "overlays": overlay_exports,
        }
        zf.writestr(
            "overlays/manifest.json",
            json.dumps(overlay_manifest, ensure_ascii=False, indent=2, default=str),
        )

        # Individual overlay HTML files from existing exports
        for exp in overlay_exports:
            export_id = exp.get("exportId", "unknown")
            scene_type = exp.get("sceneType", "unknown")
            exp_match_id = exp.get("matchId", "unknown")

            scene_def = next(
                (s for s in OVERLAY_SCENES if s["type"] == scene_type), None
            )
            width = scene_def["width"] if scene_def else 1920
            height = scene_def["height"] if scene_def else 1080

            svg = _generate_placeholder_svg(scene_type, exp_match_id, width, height)
            html = _wrap_svg_html(svg, width, height)
            zf.writestr(f"overlays/{export_id}.html", html)

        # If no existing overlay exports, generate fresh ones for the first match
        if not overlay_exports and matches:
            first_match_id = matches[0].get("matchId", "unknown")
            for scene in OVERLAY_SCENES:
                svg = _generate_placeholder_svg(
                    scene["type"], first_match_id, scene["width"], scene["height"]
                )
                html = _wrap_svg_html(svg, scene["width"], scene["height"])
                zf.writestr(f"overlays/generated_{scene['type']}.html", html)

    buf.seek(0)
    filename = f"lineupcast_full_backup_{_now_ts()}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
