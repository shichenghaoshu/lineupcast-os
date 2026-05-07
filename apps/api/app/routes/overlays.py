"""Overlay API router for OBS integration and export workflow.

Provides endpoints for listing overlays, generating overlay sets,
exporting as PNG/HTML, and retrieving browser source URLs with
secret-token authentication.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from secrets import compare_digest
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import HTMLResponse

from ..config import Settings, get_settings
from ..db import get_db
from ..security import require_admin

router = APIRouter(tags=["overlays"])

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DISCLAIMER = "For commentary assistance, not betting advice."

AVAILABLE_SCENES = [
    {
        "type": "lineup_16x9",
        "name": "Lineup Graphic (16:9)",
        "width": 1920,
        "height": 1080,
        "aspectRatio": "16:9",
    },
    {
        "type": "lineup_9x16",
        "name": "Lineup Graphic (9:16)",
        "width": 1080,
        "height": 1920,
        "aspectRatio": "9:16",
    },
    {
        "type": "prediction_strip",
        "name": "Prediction Probability Strip",
        "width": 600,
        "height": 60,
        "aspectRatio": "16:9",
    },
    {
        "type": "prediction_strip_9x16",
        "name": "Prediction Strip (9:16)",
        "width": 400,
        "height": 600,
        "aspectRatio": "9:16",
    },
    {
        "type": "short_video_9x16",
        "name": "Short Video Card (9:16)",
        "width": 1080,
        "height": 1920,
        "aspectRatio": "9:16",
    },
    {
        "type": "short_video_16x9",
        "name": "Short Video Card (16:9)",
        "width": 1920,
        "height": 1080,
        "aspectRatio": "16:9",
    },
    {
        "type": "lower_third",
        "name": "Player Lower-Third",
        "width": 800,
        "height": 100,
        "aspectRatio": "16:9",
    },
    {
        "type": "discipline_risk_16x9",
        "name": "Discipline Risk Alert (16:9)",
        "width": 1920,
        "height": 1080,
        "aspectRatio": "16:9",
    },
    {
        "type": "discipline_risk_9x16",
        "name": "Discipline Risk Alert (9:16)",
        "width": 1080,
        "height": 1920,
        "aspectRatio": "9:16",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _verify_overlay_token(
    settings: Settings,
    token: str | None = None,
) -> None:
    """Verify the overlay access token when LINEUPCAST_OVERLAY_SECRET is set.

    Raises 401 if the token does not match.
    """
    secret = getattr(settings, "overlay_secret", None) or getattr(
        settings, "admin_token", None
    )
    if not secret:
        return  # no auth required
    if not token or not compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Invalid or missing overlay token")


def _generate_placeholder_svg(
    scene_type: str,
    match_id: str,
    width: int,
    height: int,
) -> str:
    """Generate a placeholder SVG for a given scene type."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <rect width="{width}" height="{height}" fill="#0d1117" rx="0"/>
  <text x="{width / 2}" y="{height / 2 - 20}" text-anchor="middle" font-size="24" fill="#888" font-family="system-ui,sans-serif">{scene_type}</text>
  <text x="{width / 2}" y="{height / 2 + 20}" text-anchor="middle" font-size="16" fill="#555" font-family="system-ui,sans-serif">Match: {match_id}</text>
  <text x="{width / 2}" y="{height / 2 + 50}" text-anchor="middle" font-size="12" fill="#444" font-family="system-ui,sans-serif">{DISCLAIMER}</text>
</svg>"""


def _wrap_svg_html(svg: str, width: int, height: int) -> str:
    """Wrap an SVG string in a standalone HTML document for browser source."""
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

@router.get("/api/matches/{match_id}/overlays")
async def list_overlays(match_id: str) -> dict[str, Any]:
    """List available overlay scenes for a match."""
    db = get_db()
    match = db.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found")

    # Check for existing generated overlays
    exports = db.list_overlay_exports(match_id=match_id)

    return {
        "matchId": match_id,
        "scenes": AVAILABLE_SCENES,
        "generatedExports": exports,
        "totalScenes": len(AVAILABLE_SCENES),
    }


@router.post("/api/matches/{match_id}/overlays/generate")
async def generate_overlay_set(
    match_id: str,
    settings: Settings = Depends(require_admin),
) -> dict[str, Any]:
    """Generate a full set of overlay scenes for a match.

    Creates export records for all available scene types.
    """
    db = get_db()
    match = db.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found")

    generated: list[dict] = []
    for scene in AVAILABLE_SCENES:
        svg = _generate_placeholder_svg(
            scene["type"], match_id, scene["width"], scene["height"]
        )
        record = db.save_overlay_export(
            match_id=match_id,
            scene_type=scene["type"],
            format="svg",
        )
        generated.append({
            "exportId": record["exportId"],
            "sceneType": scene["type"],
            "sceneName": scene["name"],
            "width": scene["width"],
            "height": scene["height"],
            "aspectRatio": scene["aspectRatio"],
            "svg": svg,
            "exportedAt": record["exportedAt"],
        })

    return {
        "matchId": match_id,
        "generatedCount": len(generated),
        "overlays": generated,
        "disclaimer": DISCLAIMER,
        "generatedAt": _now_iso(),
    }


@router.get("/api/overlays/{overlay_id}/browser-source")
async def get_browser_source(
    overlay_id: str,
    token: str | None = Query(None, description="Secret token for authentication"),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    """Get the browser source HTML for an overlay.

    Returns a standalone HTML page suitable for OBS Browser Source.
    When LINEUPCAST_OVERLAY_SECRET is configured, the token query parameter
    is required for authentication.
    """
    _verify_overlay_token(settings, token)

    db = get_db()
    export_record = db.get_overlay_export(overlay_id)
    if not export_record:
        raise HTTPException(
            status_code=404, detail=f"Overlay '{overlay_id}' not found"
        )

    # Find scene dimensions
    scene_type = export_record["sceneType"]
    scene_def = next(
        (s for s in AVAILABLE_SCENES if s["type"] == scene_type), None
    )
    width = scene_def["width"] if scene_def else 1920
    height = scene_def["height"] if scene_def else 1080

    svg = _generate_placeholder_svg(scene_type, export_record["matchId"], width, height)
    html = _wrap_svg_html(svg, width, height)

    return HTMLResponse(content=html)


@router.get("/api/overlays/{overlay_id}/export.png")
async def export_overlay_png(
    overlay_id: str,
    token: str | None = Query(None, description="Secret token for authentication"),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Export an overlay as PNG.

    Returns SVG as a placeholder (PNG rasterisation requires sharp/canvas).
    In production, this would use a server-side rasteriser.
    """
    _verify_overlay_token(settings, token)

    db = get_db()
    export_record = db.get_overlay_export(overlay_id)
    if not export_record:
        raise HTTPException(
            status_code=404, detail=f"Overlay '{overlay_id}' not found"
        )

    scene_type = export_record["sceneType"]
    scene_def = next(
        (s for s in AVAILABLE_SCENES if s["type"] == scene_type), None
    )
    width = scene_def["width"] if scene_def else 1920
    height = scene_def["height"] if scene_def else 1080

    svg = _generate_placeholder_svg(scene_type, export_record["matchId"], width, height)

    # Record the PNG export
    db.save_overlay_export(
        match_id=export_record["matchId"],
        scene_type=scene_type,
        format="png",
    )

    # Return SVG with instructions (PNG rasterisation is a client-side concern)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Content-Disposition": f'attachment; filename="{overlay_id}.svg"',
            "X-Overlay-PNG-Note": "Use sharp/canvas to rasterise this SVG to PNG",
        },
    )


@router.get("/api/overlays/{overlay_id}/export.html")
async def export_overlay_html(
    overlay_id: str,
    token: str | None = Query(None, description="Secret token for authentication"),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    """Export an overlay as standalone HTML.

    Returns a self-contained HTML document that can be used directly
    as an OBS Browser Source or downloaded for offline use.
    """
    _verify_overlay_token(settings, token)

    db = get_db()
    export_record = db.get_overlay_export(overlay_id)
    if not export_record:
        raise HTTPException(
            status_code=404, detail=f"Overlay '{overlay_id}' not found"
        )

    scene_type = export_record["sceneType"]
    scene_def = next(
        (s for s in AVAILABLE_SCENES if s["type"] == scene_type), None
    )
    width = scene_def["width"] if scene_def else 1920
    height = scene_def["height"] if scene_def else 1080

    svg = _generate_placeholder_svg(scene_type, export_record["matchId"], width, height)
    html = _wrap_svg_html(svg, width, height)

    # Record the HTML export
    db.save_overlay_export(
        match_id=export_record["matchId"],
        scene_type=scene_type,
        format="html",
    )

    return HTMLResponse(
        content=html,
        headers={
            "Content-Disposition": f'attachment; filename="{overlay_id}.html"',
        },
    )


@router.post("/api/overlays/{overlay_id}/mark-exported")
async def mark_overlay_exported(
    overlay_id: str,
    format: str = Query("svg", description="Export format: svg, png, html, json"),
    url: str | None = Query(None, description="URL where the export is accessible"),
    _: Settings = Depends(require_admin),
) -> dict[str, Any]:
    """Mark an overlay as exported with the given format and optional URL."""
    db = get_db()
    export_record = db.get_overlay_export(overlay_id)
    if not export_record:
        raise HTTPException(
            status_code=404, detail=f"Overlay '{overlay_id}' not found"
        )

    record = db.save_overlay_export(
        match_id=export_record["matchId"],
        scene_type=export_record["sceneType"],
        format=format,
        url=url,
    )

    return {
        "exportId": record["exportId"],
        "overlayId": overlay_id,
        "format": format,
        "url": url,
        "exportedAt": record["exportedAt"],
    }


@router.get("/api/matches/{match_id}/overlays/exports")
async def list_overlay_export_history(
    match_id: str,
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List export history for a match's overlays."""
    db = get_db()
    exports = db.list_overlay_exports(match_id=match_id, limit=limit)
    return {
        "matchId": match_id,
        "exports": exports,
        "total": len(exports),
    }


@router.get("/api/overlays/exports")
async def list_all_overlay_exports(
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """List all overlay export history across all matches."""
    db = get_db()
    exports = db.list_overlay_exports(limit=limit)
    return {
        "exports": exports,
        "total": len(exports),
    }
