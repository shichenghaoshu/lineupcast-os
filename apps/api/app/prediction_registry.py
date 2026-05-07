"""Prediction Registry with input snapshots for LineupCast OS.

Every prediction MUST save an input snapshot.  Input snapshots are immutable
once saved.  Historical prediction records must never be modified.

Disclaimer: For commentary assistance, not betting advice.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException

from .db import get_db


def now_utc() -> datetime:
    return datetime.now(UTC)


def _not_found(resource: str, resource_id: str) -> None:
    raise HTTPException(status_code=404, detail=f"{resource} '{resource_id}' not found")


def save_prediction_record(
    match_id: str,
    prediction_data: dict,
    input_snapshot: dict,
    model_info: dict | None = None,
) -> dict:
    """Persist a prediction record with full audit trail.

    Args:
        match_id: The match identifier.
        prediction_data: The full prediction output (output snapshot).
        input_snapshot: The immutable capture of all input data at prediction time.
        model_info: Dict with keys like modelName, modelVersion, dataVersion,
                    providerIds, providerFreshness, missingFields, confidenceCap,
                    fallbackMethods, degraded.

    Returns:
        The persisted record dict including predictionId.
    """
    model_info = model_info or {}

    db = get_db()
    record = db.save_prediction_registry_entry(
        match_id=match_id,
        model_name=model_info.get("modelName", prediction_data.get("modelName", "unknown")),
        model_version=model_info.get("modelVersion", prediction_data.get("modelVersion", "0.0.0")),
        confidence=prediction_data.get("confidence", 0.0),
        input_snapshot=input_snapshot,
        output_snapshot=prediction_data,
        data_version=model_info.get("dataVersion"),
        provider_ids=model_info.get("providerIds", []),
        provider_freshness=model_info.get("providerFreshness", {}),
        missing_fields=model_info.get("missingFields", []),
        explanation=prediction_data.get("explanation", ""),
        confidence_cap=model_info.get("confidenceCap", 1.0),
        fallback_methods=model_info.get("fallbackMethods", []),
        degraded=model_info.get("degraded", False),
    )
    return record


def get_prediction_record(prediction_id: str) -> dict:
    """Retrieve a prediction record with its input snapshot.

    Returns the full record including inputSnapshot, outputSnapshot,
    and all audit fields.

    Raises:
        HTTPException(404) if the record does not exist.
    """
    db = get_db()
    record = db.get_prediction_registry_entry(prediction_id)
    if record is None:
        _not_found("Prediction record", prediction_id)
    return record


def list_prediction_records(match_id: str) -> list[dict]:
    """List all prediction records for a match.

    Returns records ordered by most recent first.
    """
    db = get_db()
    return db.list_prediction_registry_entries(match_id)


def get_prediction_audit(prediction_id: str) -> dict:
    """Return full audit info for a prediction.

    Includes model version, data version, provider IDs, provider freshness,
    missing fields, confidence cap, fallback methods, and degraded flag.

    Raises:
        HTTPException(404) if the record does not exist.
    """
    record = get_prediction_record(prediction_id)
    return {
        "predictionId": record["predictionId"],
        "matchId": record["matchId"],
        "modelName": record["modelName"],
        "modelVersion": record["modelVersion"],
        "dataVersion": record["dataVersion"],
        "providerIds": record["providerIds"],
        "providerFreshness": record["providerFreshness"],
        "missingFields": record["missingFields"],
        "confidence": record["confidence"],
        "confidenceCap": record["confidenceCap"],
        "degraded": record["degraded"],
        "fallbackMethods": record["fallbackMethods"],
        "generatedAt": record["generatedAt"],
    }
