"""API Configuration Center routes.

Provides CRUD + test endpoints for managing external API provider
configurations (API keys, base URLs, model IDs) with encryption at rest.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, status

from .. import api_config_service as svc
from ..schemas import (
    ApiConfigurationCreate,
    ApiConfigurationListResponse,
    ApiConfigurationResponse,
    ApiConfigurationTestResult,
    ApiConfigurationUpdate,
    DataCompletenessResponse,
    LlmStatusResponse,
    LlmTestRequest,
    LlmTestResponse,
)
from ..security import require_admin

router = APIRouter(tags=["settings"])


# ---------------------------------------------------------------------------
# Provider configuration CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/api/settings/providers",
    response_model=ApiConfigurationListResponse,
)
async def list_providers() -> ApiConfigurationListResponse:
    """List all stored API provider configurations, plus env fallbacks."""
    configs = svc.list_resolved_configurations()
    return ApiConfigurationListResponse(configurations=configs, total=len(configs))


@router.get(
    "/api/settings/providers/{config_id}",
    response_model=ApiConfigurationResponse,
)
async def get_provider(config_id: int) -> ApiConfigurationResponse:
    """Get a single provider configuration by id."""
    return svc.get_configuration(config_id)


@router.post(
    "/api/settings/providers",
    response_model=ApiConfigurationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_provider(
    payload: ApiConfigurationCreate,
    _: dict = Depends(require_admin),
) -> ApiConfigurationResponse:
    """Create a new provider configuration (admin only)."""
    return svc.create_configuration(payload.model_dump(mode="json"))


@router.patch(
    "/api/settings/providers/{config_id}",
    response_model=ApiConfigurationResponse,
)
async def update_provider(
    config_id: int,
    payload: ApiConfigurationUpdate,
    _: dict = Depends(require_admin),
) -> ApiConfigurationResponse:
    """Update an existing provider configuration (admin only)."""
    return svc.update_configuration(
        config_id,
        payload.model_dump(mode="json", exclude_unset=True),
    )


@router.delete(
    "/api/settings/providers/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_provider(
    config_id: int,
    _: dict = Depends(require_admin),
) -> None:
    """Delete a provider configuration (admin only)."""
    svc.delete_configuration(config_id)


@router.post(
    "/api/settings/providers/{config_id}/test",
    response_model=ApiConfigurationTestResult,
)
async def test_provider(
    config_id: int,
    _: dict = Depends(require_admin),
) -> ApiConfigurationTestResult:
    """Test the connection to a configured provider (admin only)."""
    return svc.test_configuration(config_id)


@router.post(
    "/api/settings/providers/{config_id}/rotate-key",
    response_model=ApiConfigurationResponse,
)
async def rotate_provider_key(
    config_id: int,
    new_key: str = Body(..., media_type="text/plain"),
    _: dict = Depends(require_admin),
) -> ApiConfigurationResponse:
    """Rotate the API key for a provider (admin only).

    The new key should be passed as plain text in the request body.
    """
    if not new_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_key must not be empty.",
        )
    return svc.rotate_key(config_id, new_key)


@router.get(
    "/api/settings/providers/{config_id}/status",
)
async def get_provider_status(
    config_id: int,
) -> dict:
    """Get the current status of a provider configuration."""
    return svc.get_configuration_status(config_id)


# ---------------------------------------------------------------------------
# LLM endpoints
# ---------------------------------------------------------------------------


@router.get("/api/llm/status", response_model=LlmStatusResponse)
async def llm_status() -> LlmStatusResponse:
    """Return the status of the best available LLM provider."""
    return svc.get_llm_status()


@router.post("/api/llm/test", response_model=LlmTestResponse)
async def llm_test(
    payload: LlmTestRequest,
    _: dict = Depends(require_admin),
) -> LlmTestResponse:
    """Test LLM generation with the configured provider (admin only)."""
    return svc.test_llm_generation(payload.prompt)


# ---------------------------------------------------------------------------
# Data completeness
# ---------------------------------------------------------------------------


@router.get(
    "/api/matches/{match_id}/data-completeness",
    response_model=DataCompletenessResponse,
)
async def get_data_completeness(match_id: str) -> DataCompletenessResponse:
    """Return a data completeness score for a match.

    Scans available data categories (lineups, predictions, stats, etc.)
    and returns a percentage score with details on what is missing.
    """
    from ..db import get_db

    db = get_db()

    # Check match exists
    match = db.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found")

    available: list[str] = []
    missing: list[str] = []
    degraded_reasons: list[str] = []
    flags: dict[str, bool] = {}

    # 1. Match basic data
    if match:
        available.append("match")
        flags["match"] = True
    else:
        missing.append("match")
        flags["match"] = False

    # 2. Lineups
    from src.mock_data import LINEUPS
    lineup_data = LINEUPS.get(match_id)
    if lineup_data:
        available.append("lineups")
        flags["lineups"] = True
    else:
        missing.append("lineups")
        flags["lineups"] = False

    # 3. Predictions
    latest_pred = db.get_latest_prediction(match_id)
    if latest_pred:
        available.append("predictions")
        flags["predictions"] = True
    else:
        missing.append("predictions")
        flags["predictions"] = False

    # 4. Team data
    home_team = match.get("homeTeam", {})
    away_team = match.get("awayTeam", {})
    if home_team.get("teamId") and away_team.get("teamId"):
        available.append("teams")
        flags["teams"] = True
    else:
        missing.append("teams")
        flags["teams"] = False
        degraded_reasons.append("Team data incomplete")

    # 5. Scripts / commentary
    scripts = db.list_scripts(match_id) if hasattr(db, 'list_scripts') else []
    if scripts:
        available.append("scripts")
        flags["scripts"] = True
    else:
        missing.append("scripts")
        flags["scripts"] = False

    # 6. Provider data
    provider_runs = db.list_provider_runs(limit=5)
    if provider_runs:
        available.append("provider_data")
        flags["provider_data"] = True
    else:
        missing.append("provider_data")
        flags["provider_data"] = False

    # Calculate score (0-100)
    total_categories = 6
    score = int((len(available) / total_categories) * 100)

    # Confidence cap based on missing categories
    confidence_cap = 1.0
    if "lineups" in missing:
        confidence_cap -= 0.2
        degraded_reasons.append("Lineup data not available")
    if "predictions" in missing:
        confidence_cap -= 0.2
        degraded_reasons.append("No predictions generated")
    if "teams" in missing:
        confidence_cap -= 0.15
    confidence_cap = max(0.0, confidence_cap)

    warning = None
    if score < 50:
        warning = "Low data completeness - predictions may be unreliable"

    return DataCompletenessResponse(
        score=score,
        availableCategories=available,
        missingCategories=missing,
        degradedReasons=degraded_reasons,
        warning=warning,
        confidenceCap=round(confidence_cap, 2),
        flags=flags,
    )
