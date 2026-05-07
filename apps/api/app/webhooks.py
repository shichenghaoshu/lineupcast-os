"""Webhook delivery engine with HMAC signing and retry logic.

Provides event dispatching to registered webhook endpoints with:
- HMAC-SHA256 signature verification
- Exponential backoff retry (up to 3 attempts)
- Background delivery via asyncio
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from .db import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported event types
# ---------------------------------------------------------------------------

VALID_EVENTS = frozenset(
    {
        "prediction.created",
        "script.generated",
        "overlay.exported",
    }
)

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # seconds: 2, 4, 8


# ---------------------------------------------------------------------------
# HMAC helpers
# ---------------------------------------------------------------------------


def compute_signature(payload_bytes: bytes, secret: str) -> str:
    """Compute HMAC-SHA256 hex digest for a payload."""
    return hmac.new(
        secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()


def verify_signature(payload_bytes: bytes, secret: str, signature: str) -> bool:
    """Verify an HMAC-SHA256 signature using constant-time comparison."""
    expected = compute_signature(payload_bytes, secret)
    return hmac.compare_digest(expected, signature)


# ---------------------------------------------------------------------------
# Payload construction
# ---------------------------------------------------------------------------


def build_event_payload(
    event_type: str,
    data: dict[str, Any],
    webhook_id: str | None = None,
) -> dict[str, Any]:
    """Build a standard event payload for webhook delivery."""
    return {
        "event": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        "webhookId": webhook_id,
        "data": data,
    }


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------


async def deliver_webhook(
    webhook: dict,
    event_type: str,
    payload: dict[str, Any],
    attempt: int = 1,
) -> dict[str, Any]:
    """Deliver a single webhook event with HMAC signature.

    Returns a dict with delivery status information.
    """
    db = get_db()
    payload_bytes = json.dumps(payload, default=str, separators=(",", ":")).encode(
        "utf-8"
    )
    signature = compute_signature(payload_bytes, webhook["secret"])

    headers = {
        "Content-Type": "application/json",
        "X-LineupCast-Event": event_type,
        "X-LineupCast-Signature": f"sha256={signature}",
        "X-LineupCast-Delivery-Attempt": str(attempt),
        "User-Agent": "LineupCast-Webhook/1.0",
    }

    delivery = db.save_webhook_delivery(
        webhook_id=webhook["webhookId"],
        event_type=event_type,
        payload=payload,
        status="pending",
        attempt=attempt,
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook["url"],
                content=payload_bytes,
                headers=headers,
            )
            status_code = response.status_code
            response_text = response.text[:2000]  # truncate large responses

            if 200 <= status_code < 300:
                db.update_webhook_delivery(
                    delivery_id=delivery["deliveryId"],
                    status="delivered",
                    status_code=status_code,
                    response=response_text,
                )
                logger.info(
                    "Webhook delivered: %s -> %s [%d]",
                    event_type,
                    webhook["url"],
                    status_code,
                )
                return {
                    "status": "delivered",
                    "statusCode": status_code,
                    "attempt": attempt,
                }
            else:
                db.update_webhook_delivery(
                    delivery_id=delivery["deliveryId"],
                    status="failed",
                    status_code=status_code,
                    response=response_text,
                )
                logger.warning(
                    "Webhook delivery failed: %s -> %s [%d]",
                    event_type,
                    webhook["url"],
                    status_code,
                )
                return {
                    "status": "failed",
                    "statusCode": status_code,
                    "attempt": attempt,
                    "response": response_text,
                }

    except Exception as exc:
        error_msg = str(exc)[:500]
        db.update_webhook_delivery(
            delivery_id=delivery["deliveryId"],
            status="error",
            response=error_msg,
        )
        logger.error(
            "Webhook delivery error: %s -> %s: %s",
            event_type,
            webhook["url"],
            error_msg,
        )
        return {
            "status": "error",
            "attempt": attempt,
            "error": error_msg,
        }


async def dispatch_event(
    event_type: str,
    data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Dispatch an event to all subscribed webhooks with retry logic.

    For each active webhook subscribed to the event type:
    1. Build the payload with HMAC signature
    2. Attempt delivery up to MAX_RETRIES times
    3. Use exponential backoff between retries

    Returns a list of delivery result dicts.
    """
    if event_type not in VALID_EVENTS:
        logger.warning("Unknown event type: %s", event_type)
        return []

    db = get_db()
    webhooks = db.get_active_webhooks_for_event(event_type)

    if not webhooks:
        logger.debug("No webhooks subscribed to event: %s", event_type)
        return []

    results: list[dict[str, Any]] = []

    for webhook in webhooks:
        payload = build_event_payload(
            event_type=event_type,
            data=data,
            webhook_id=webhook["webhookId"],
        )

        result = await deliver_webhook(webhook, event_type, payload, attempt=1)

        # Retry on non-success status codes (not 2xx)
        attempt = 1
        while (
            result.get("status") not in ("delivered",)
            and attempt < MAX_RETRIES
        ):
            attempt += 1
            backoff = RETRY_BACKOFF_BASE ** (attempt - 1)
            logger.info(
                "Retrying webhook %s (attempt %d/%d) after %ds",
                webhook["webhookId"],
                attempt,
                MAX_RETRIES,
                backoff,
            )

            await asyncio.sleep(backoff)

            result = await deliver_webhook(
                webhook, event_type, payload, attempt=attempt
            )

        results.append(
            {
                "webhookId": webhook["webhookId"],
                "url": webhook["url"],
                **result,
            }
        )

    return results


# ---------------------------------------------------------------------------
# Test delivery (for POST /api/webhooks/{id}/test)
# ---------------------------------------------------------------------------


async def send_test_event(webhook_id: str) -> dict[str, Any]:
    """Send a test ping event to a specific webhook.

    Returns the delivery result.
    """
    db = get_db()
    webhook = db.get_webhook(webhook_id)
    if webhook is None:
        return {"error": "Webhook not found", "status": "not_found"}

    test_payload = build_event_payload(
        event_type="test.ping",
        data={
            "message": "This is a test webhook delivery from LineupCast.",
            "webhookId": webhook_id,
        },
        webhook_id=webhook_id,
    )

    return await deliver_webhook(webhook, "test.ping", test_payload, attempt=1)
