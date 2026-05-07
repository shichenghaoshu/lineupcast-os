"""Service layer for API Configuration Center.

CRUD + test operations on :class:`ApiConfiguration` rows.  API keys are
encrypted at rest and only masked versions are ever returned to callers.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import UTC, datetime

from fastapi import HTTPException

from .database import get_session
from .models import ApiConfiguration
from .secrets_util import decrypt_value, encrypt_value, mask_api_key

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapping from provider_type to env-var names for fallback
# ---------------------------------------------------------------------------

_PROVIDER_ENV_MAP: dict[str, dict[str, str]] = {
    "football-data": {
        "api_key": "FOOTBALL_DATA_API_KEY",
        "base_url": "FOOTBALL_DATA_BASE_URL",
    },
    "sportmonks": {
        "api_key": "SPORTMONKS_API_KEY",
        "base_url": "SPORTMONKS_BASE_URL",
    },
    "api-football": {
        "api_key": "API_FOOTBALL_KEY",
        "base_url": "API_FOOTBALL_BASE_URL",
    },
    "thesports": {
        "api_key": "THESPORTS_API_KEY",
        "base_url": "THESPORTS_BASE_URL",
    },
    "huggingface": {
        "api_key": "HUGGINGFACE_API_TOKEN",
        "base_url": "HUGGINGFACE_BASE_URL",
    },
    "openai-compatible": {
        "api_key": "OPENAI_COMPATIBLE_API_KEY",
        "base_url": "OPENAI_COMPATIBLE_BASE_URL",
        "model_id": "OPENAI_COMPATIBLE_MODEL_ID",
    },
    "openai": {
        "api_key": "OPENAI_API_KEY",
        "base_url": "OPENAI_BASE_URL",
        "model_id": "OPENAI_MODEL_ID",
    },
    "obs": {
        "api_key": "OBS_API_KEY",
        "base_url": "OBS_BASE_URL",
    },
    "storage": {
        "api_key": "STORAGE_API_KEY",
        "base_url": "STORAGE_BASE_URL",
    },
    "webhook": {
        "api_key": "WEBHOOK_SECRET",
        "base_url": "WEBHOOK_BASE_URL",
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_response(row: ApiConfiguration) -> dict:
    """Convert an ORM row to a serialisable dict (never includes raw key)."""
    return {
        "id": row.id,
        "providerType": row.provider_type,
        "displayName": row.display_name,
        "baseUrl": row.base_url,
        "modelId": row.model_id,
        "maskedApiKey": row.masked_api_key or "",
        "status": row.status,
        "lastTestAt": row.last_test_at,
        "lastTestResult": row.last_test_result,
        "extraConfig": row.extra_config,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def _get_or_404(session, config_id: int) -> ApiConfiguration:
    """Fetch a config row or raise 404."""
    row = session.get(ApiConfiguration, config_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"API configuration {config_id} not found")
    return row


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def list_configurations() -> list[dict]:
    """Return all stored configurations (never includes raw keys)."""
    with get_session() as session:
        rows = session.query(ApiConfiguration).order_by(ApiConfiguration.id).all()
        return [_row_to_response(r) for r in rows]


def get_configuration(config_id: int) -> dict:
    """Return a single configuration by id."""
    with get_session() as session:
        row = _get_or_404(session, config_id)
        return _row_to_response(row)


def create_configuration(data: dict) -> dict:
    """Create a new API configuration.

    *data* keys use camelCase (matching the Pydantic schema).
    """
    api_key = data.get("apiKey")
    encrypted = None
    masked = ""
    status = "missing"
    if api_key:
        encrypted = encrypt_value(api_key)
        masked = mask_api_key(api_key)
        status = "configured"

    with get_session() as session:
        row = ApiConfiguration(
            provider_type=data["providerType"],
            display_name=data["displayName"],
            base_url=data.get("baseUrl"),
            model_id=data.get("modelId"),
            encrypted_api_key=encrypted,
            masked_api_key=masked,
            status=status,
            extra_config=data.get("extraConfig"),
        )
        session.add(row)
        session.flush()  # to get the id
        result = _row_to_response(row)
    return result


def update_configuration(config_id: int, data: dict) -> dict:
    """Update an existing configuration.

    If a new ``apiKey`` is supplied, re-encrypt and update the masked version.
    """
    with get_session() as session:
        row = _get_or_404(session, config_id)

        if "displayName" in data and data["displayName"] is not None:
            row.display_name = data["displayName"]
        if "baseUrl" in data:
            row.base_url = data["baseUrl"]
        if "modelId" in data:
            row.model_id = data["modelId"]
        if "extraConfig" in data:
            row.extra_config = data["extraConfig"]

        api_key = data.get("apiKey")
        if api_key is not None:
            row.encrypted_api_key = encrypt_value(api_key)
            row.masked_api_key = mask_api_key(api_key)
            row.status = "configured"

        session.flush()
        result = _row_to_response(row)
    return result


def delete_configuration(config_id: int) -> None:
    """Delete a configuration.  Raises 404 if not found."""
    with get_session() as session:
        row = _get_or_404(session, config_id)
        session.delete(row)


def rotate_key(config_id: int, new_key: str) -> dict:
    """Re-encrypt with a new API key."""
    with get_session() as session:
        row = _get_or_404(session, config_id)
        row.encrypted_api_key = encrypt_value(new_key)
        row.masked_api_key = mask_api_key(new_key)
        row.status = "configured"
        session.flush()
        result = _row_to_response(row)
    return result


def get_configuration_status(config_id: int) -> dict:
    """Return the current status of a configuration."""
    with get_session() as session:
        row = _get_or_404(session, config_id)
        return {
            "id": row.id,
            "providerType": row.provider_type,
            "status": row.status,
            "lastTestAt": row.last_test_at,
            "lastTestResult": row.last_test_result,
        }


# ---------------------------------------------------------------------------
# Env fallback
# ---------------------------------------------------------------------------

def get_env_fallback(provider_type: str) -> dict | None:
    """Build a virtual configuration dict from environment variables.

    Returns ``None`` when no relevant env vars are set.
    Priority: DB config > env fallback.
    """
    env_map = _PROVIDER_ENV_MAP.get(provider_type)
    if not env_map:
        return None

    api_key_env = env_map.get("api_key", "")
    api_key = os.getenv(api_key_env) if api_key_env else None
    base_url = os.getenv(env_map.get("base_url", "")) if env_map.get("base_url") else None
    model_id = os.getenv(env_map.get("model_id", "")) if env_map.get("model_id") else None

    if not api_key and not base_url:
        return None

    return {
        "id": None,
        "providerType": provider_type,
        "displayName": f"{provider_type} (env)",
        "baseUrl": base_url,
        "modelId": model_id,
        "maskedApiKey": mask_api_key(api_key) if api_key else "",
        "status": "configured" if api_key else "missing",
        "lastTestAt": None,
        "lastTestResult": None,
        "extraConfig": None,
        "createdAt": None,
        "updatedAt": None,
        "_from_env": True,
    }


def get_resolved_configuration(config_id: int) -> dict:
    """Get a single config, returning DB row or env fallback.

    For provider_type-based lookup when config_id is None, use list + filter.
    """
    return get_configuration(config_id)


def list_resolved_configurations() -> list[dict]:
    """List DB configs and fill in env fallbacks for missing provider types."""
    db_configs = list_configurations()
    seen_types = {c["providerType"] for c in db_configs}
    result = list(db_configs)

    for provider_type in _PROVIDER_ENV_MAP:
        if provider_type not in seen_types:
            fallback = get_env_fallback(provider_type)
            if fallback:
                result.append(fallback)

    return result


# ---------------------------------------------------------------------------
# Provider test
# ---------------------------------------------------------------------------

# Mapping of provider_type to their test URL patterns
_PROVIDER_TEST_URLS: dict[str, str] = {
    "football-data": "https://api.football-data.org/v4/competitions",
    "sportmonks": "https://api.sportmonks.com/v3/football",
    "api-football": "https://v3.football.api-sports.io/status",
    "thesports": "https://api.thesports.com/v1",
    "huggingface": "https://api-inference.huggingface.co/models",
    "openai": "https://api.openai.com/v1/models",
    "openai-compatible": "",  # requires base_url
}


def _get_decrypted_key(config_id: int) -> str | None:
    """Retrieve and decrypt the API key for a stored configuration."""
    with get_session() as session:
        row = session.get(ApiConfiguration, config_id)
        if row is None or not row.encrypted_api_key:
            return None
        return decrypt_value(row.encrypted_api_key)


def test_configuration(config_id: int) -> dict:
    """Perform an HTTP test against the configured provider.

    Returns a result dict matching ``ApiConfigurationTestResult``.
    """
    import httpx

    with get_session() as session:
        row = _get_or_404(session, config_id)
        provider_type = row.provider_type
        base_url = row.base_url
        encrypted_key = row.encrypted_api_key
        model_id = row.model_id

    api_key: str | None = None
    if encrypted_key:
        try:
            api_key = decrypt_value(encrypted_key)
        except Exception as exc:
            logger.warning("Failed to decrypt API key for config %d: %s", config_id, exc)

    # Determine test URL
    test_url = base_url or _PROVIDER_TEST_URLS.get(provider_type, "")

    if not test_url:
        result = {
            "providerId": config_id,
            "ok": False,
            "status": "error",
            "latencyMs": 0,
            "detail": f"No base URL configured for provider type '{provider_type}'.",
            "capabilities": [],
        }
        _update_test_result(config_id, result)
        return result

    if not api_key and provider_type not in ("obs", "storage"):
        result = {
            "providerId": config_id,
            "ok": False,
            "status": "missing",
            "latencyMs": 0,
            "detail": "API key is not configured. Please add an API key first.",
            "capabilities": [],
        }
        _update_test_result(config_id, result)
        return result

    # Perform actual HTTP test
    start = time.monotonic()
    headers: dict[str, str] = {}
    if api_key:
        if provider_type in ("huggingface",):
            headers["Authorization"] = f"Bearer {api_key}"
        elif provider_type in ("openai", "openai-compatible"):
            headers["Authorization"] = f"Bearer {api_key}"
        elif provider_type == "football-data":
            headers["X-Auth-Token"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"

    capabilities: list[str] = []
    try:
        with httpx.Client(timeout=10) as client:
            response = client.get(test_url, headers=headers)
        latency_ms = int((time.monotonic() - start) * 1000)

        if response.status_code == 200:
            status = "healthy"
            ok = True
            detail = f"Connection successful (HTTP {response.status_code})."
            # Try to detect capabilities from response
            try:
                body = response.json()
                if isinstance(body, dict):
                    if "competitions" in body or "matches" in body:
                        capabilities.append("matches")
                    if "teams" in body:
                        capabilities.append("teams")
                    if "players" in body or "squad" in body:
                        capabilities.append("players")
            except Exception:
                pass
        elif response.status_code in (401, 403):
            status = "error"
            ok = False
            detail = f"Authentication failed (HTTP {response.status_code}). Check your API key."
        elif response.status_code == 429:
            status = "rate_limited"
            ok = False
            detail = "Rate limited by the provider. Try again later."
        else:
            status = "degraded"
            ok = False
            detail = f"Unexpected response (HTTP {response.status_code})."

    except httpx.TimeoutException:
        latency_ms = int((time.monotonic() - start) * 1000)
        status = "error"
        ok = False
        detail = f"Connection timed out after {latency_ms}ms."
    except httpx.ConnectError as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        status = "error"
        ok = False
        detail = f"Connection failed: {exc}"
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        status = "error"
        ok = False
        detail = f"Unexpected error: {exc}"

    result = {
        "providerId": config_id,
        "ok": ok,
        "status": status,
        "latencyMs": latency_ms,
        "detail": detail,
        "capabilities": capabilities,
    }
    _update_test_result(config_id, result)
    return result


def _update_test_result(config_id: int, result: dict) -> None:
    """Persist the test result on the configuration row."""
    try:
        with get_session() as session:
            row = session.get(ApiConfiguration, config_id)
            if row:
                row.status = result["status"]
                row.last_test_at = datetime.now(UTC)
                row.last_test_result = result
    except Exception:
        logger.warning("Failed to update test result for config %d", config_id, exc_info=True)


# ---------------------------------------------------------------------------
# LLM-specific helpers
# ---------------------------------------------------------------------------

def get_llm_status() -> dict:
    """Return the status of the best available LLM provider.

    Priority: DB openai > DB openai-compatible > DB huggingface > env fallbacks.
    """
    configs = list_resolved_configurations()
    llm_types = ("openai", "openai-compatible", "huggingface")
    for ptype in llm_types:
        for cfg in configs:
            if cfg["providerType"] == ptype and cfg.get("status") in ("configured", "healthy"):
                return {
                    "provider": cfg["providerType"],
                    "modelId": cfg.get("modelId"),
                    "baseUrl": cfg.get("baseUrl"),
                    "status": cfg["status"],
                    "fallbackEnabled": True,
                    "latencyMs": None,
                    "lastTestResult": cfg.get("lastTestResult"),
                    "maskedApiKey": cfg.get("maskedApiKey", ""),
                }

    # Nothing configured
    return {
        "provider": "none",
        "modelId": None,
        "baseUrl": None,
        "status": "missing",
        "fallbackEnabled": True,
        "latencyMs": None,
        "lastTestResult": None,
        "maskedApiKey": "",
    }


def test_llm_generation(prompt: str) -> dict:
    """Test LLM generation with the configured provider.

    Falls back to a deterministic response if no LLM is configured.
    """
    import httpx

    llm_status = get_llm_status()
    provider = llm_status["provider"]

    if provider == "none" or llm_status["status"] == "missing":
        return {
            "ok": True,
            "provider": "fallback-deterministic",
            "modelId": None,
            "latencyMs": 0,
            "output": f"[Fallback] Football analysis: {prompt[:50]}...",
            "fallback": True,
            "detail": "No LLM provider configured. Using deterministic fallback.",
        }

    # Try real LLM call for openai-compatible providers
    base_url = llm_status.get("baseUrl", "")
    model_id = llm_status.get("modelId", "gpt-3.5-turbo")

    if provider in ("openai", "openai-compatible"):
        # Find the config to get the decrypted key
        configs = list_resolved_configurations()
        api_key = None
        for cfg in configs:
            if cfg["providerType"] == provider:
                # Try to get from DB
                if cfg.get("id"):
                    api_key = _get_decrypted_key(cfg["id"])
                break

        if not api_key:
            return {
                "ok": False,
                "provider": provider,
                "modelId": model_id,
                "latencyMs": 0,
                "output": None,
                "fallback": True,
                "detail": "Could not retrieve API key for LLM test.",
            }

        url = (base_url.rstrip("/") if base_url else "https://api.openai.com/v1") + "/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 100,
        }

        start = time.monotonic()
        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, json=payload, headers=headers)
            latency_ms = int((time.monotonic() - start) * 1000)

            if response.status_code == 200:
                body = response.json()
                output = body.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {
                    "ok": True,
                    "provider": provider,
                    "modelId": model_id,
                    "latencyMs": latency_ms,
                    "output": output.strip(),
                    "fallback": False,
                    "detail": "LLM generation successful.",
                }
            else:
                return {
                    "ok": False,
                    "provider": provider,
                    "modelId": model_id,
                    "latencyMs": latency_ms,
                    "output": None,
                    "fallback": True,
                    "detail": f"LLM returned HTTP {response.status_code}.",
                }
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            return {
                "ok": False,
                "provider": provider,
                "modelId": model_id,
                "latencyMs": latency_ms,
                "output": None,
                "fallback": True,
                "detail": f"LLM test failed: {exc}",
            }

    return {
        "ok": True,
        "provider": "fallback-deterministic",
        "modelId": None,
        "latencyMs": 0,
        "output": f"[Fallback] Football analysis: {prompt[:50]}...",
        "fallback": True,
        "detail": f"Provider type '{provider}' does not support direct test.",
    }
