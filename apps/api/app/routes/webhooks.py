"""Webhook management API router.

Provides endpoints for registering, listing, deleting, and testing
webhook subscriptions that receive event notifications.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings
from ..db import get_db
from ..schemas import (
    WebhookCreate,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookTestResponse,
)
from ..security import require_admin
from ..webhooks import VALID_EVENTS, send_test_event

router = APIRouter(tags=["webhooks"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_events(events: list[str]) -> None:
    """Raise 400 if any event type is not supported."""
    invalid = [e for e in events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "invalid_event_types",
                "message": f"Unsupported event types: {invalid}",
                "validEvents": sorted(VALID_EVENTS),
            },
        )


def _to_webhook_response(webhook: dict) -> WebhookResponse:
    """Convert a webhook DB dict to a response model."""
    return WebhookResponse(
        webhookId=webhook["webhookId"],
        url=webhook["url"],
        events=webhook["events"],
        active=webhook["active"],
        createdAt=webhook["createdAt"],
        updatedAt=webhook["updatedAt"],
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/api/webhooks",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_webhook(
    payload: WebhookCreate,
    _: Settings = Depends(require_admin),
) -> WebhookResponse:
    """Register a new webhook subscription.

    The webhook will receive POST requests for the specified event types.
    Each delivery includes an HMAC-SHA256 signature in the
    X-LineupCast-Signature header for payload verification.
    """
    _validate_events(payload.events)

    db = get_db()
    webhook = db.save_webhook(
        url=payload.url,
        events=payload.events,
        secret=payload.secret,
    )
    return _to_webhook_response(webhook)


@router.get("/api/webhooks", response_model=WebhookListResponse)
async def list_webhooks(
    _: Settings = Depends(require_admin),
) -> WebhookListResponse:
    """List all registered webhook subscriptions.

    Returns webhook metadata without secrets.
    """
    db = get_db()
    webhooks = db.list_webhooks()
    return WebhookListResponse(
        webhooks=[_to_webhook_response(w) for w in webhooks],
        total=len(webhooks),
    )


@router.delete(
    "/api/webhooks/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_webhook(
    webhook_id: str,
    _: Settings = Depends(require_admin),
) -> None:
    """Delete a webhook subscription and its delivery history."""
    db = get_db()
    deleted = db.delete_webhook(webhook_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook '{webhook_id}' not found",
        )


@router.post(
    "/api/webhooks/{webhook_id}/test",
    response_model=WebhookTestResponse,
)
async def test_webhook(
    webhook_id: str,
    _: Settings = Depends(require_admin),
) -> WebhookTestResponse:
    """Send a test event to a specific webhook.

    Delivers a 'test.ping' event with a sample payload and returns
    the delivery result.
    """
    db = get_db()
    webhook = db.get_webhook(webhook_id)
    if webhook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook '{webhook_id}' not found",
        )

    result = await send_test_event(webhook_id)
    return WebhookTestResponse(
        webhookId=result.get("webhookId", webhook_id),
        status=result.get("status", "unknown"),
        statusCode=result.get("statusCode"),
        attempt=result.get("attempt"),
        error=result.get("error"),
    )


@router.get(
    "/api/webhooks/{webhook_id}/deliveries",
    response_model=list[WebhookDeliveryResponse],
)
async def list_webhook_deliveries(
    webhook_id: str,
    limit: int = 50,
    _: Settings = Depends(require_admin),
) -> list[WebhookDeliveryResponse]:
    """List recent delivery attempts for a webhook."""
    db = get_db()
    webhook = db.get_webhook(webhook_id)
    if webhook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Webhook '{webhook_id}' not found",
        )

    deliveries = db.list_webhook_deliveries(webhook_id, limit=limit)
    return [
        WebhookDeliveryResponse(
            deliveryId=d["deliveryId"],
            webhookId=d["webhookId"],
            eventType=d["eventType"],
            payload=d["payload"],
            status=d["status"],
            statusCode=d["statusCode"],
            response=d["response"],
            attempt=d["attempt"],
            createdAt=d["createdAt"],
        )
        for d in deliveries
    ]
