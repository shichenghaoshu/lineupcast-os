"""Tests for the webhook system.

Covers:
- Webhook registration (POST /api/webhooks)
- Webhook listing (GET /api/webhooks)
- Webhook deletion (DELETE /api/webhooks/{id})
- Test delivery (POST /api/webhooks/{id}/test)
- Delivery history (GET /api/webhooks/{id}/deliveries)
- HMAC signature computation and verification
- Event dispatch with retry logic
- Event type validation
"""

from __future__ import annotations

import json
import os
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.db import Database, get_db, reset_db
from app.webhooks import (
    VALID_EVENTS,
    build_event_payload,
    compute_signature,
    verify_signature,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path):
    """Point the database at a temp directory for each test."""
    reset_db()
    db = Database(tmp_path / "test_webhooks.db")
    import app.db as db_module
    db_module._db_instance = db
    yield db
    reset_db()


@pytest_asyncio.fixture
async def client():
    """Create an isolated test client with dev_mode enabled."""
    os.environ["LINEUPCAST_DEV_MODE"] = "true"
    get_settings.cache_clear()

    from app.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _auth_header() -> dict[str, str]:
    """Return admin auth header (dev mode auto-accepts)."""
    return {}


# ---------------------------------------------------------------------------
# HMAC unit tests
# ---------------------------------------------------------------------------


class TestHMACSignature:
    def test_compute_signature_deterministic(self):
        payload = b'{"event":"test"}'
        secret = "my-secret-key-1234"
        sig1 = compute_signature(payload, secret)
        sig2 = compute_signature(payload, secret)
        assert sig1 == sig2
        assert len(sig1) == 64  # SHA-256 hex digest length

    def test_compute_signature_different_secrets_differ(self):
        payload = b'{"event":"test"}'
        sig1 = compute_signature(payload, "secret-a")
        sig2 = compute_signature(payload, "secret-b")
        assert sig1 != sig2

    def test_compute_signature_different_payloads_differ(self):
        secret = "same-secret"
        sig1 = compute_signature(b'{"event":"a"}', secret)
        sig2 = compute_signature(b'{"event":"b"}', secret)
        assert sig1 != sig2

    def test_verify_signature_valid(self):
        payload = b'{"event":"test"}'
        secret = "test-secret-key"
        sig = compute_signature(payload, secret)
        assert verify_signature(payload, secret, sig) is True

    def test_verify_signature_invalid(self):
        payload = b'{"event":"test"}'
        secret = "test-secret-key"
        assert verify_signature(payload, secret, "bad-signature") is False

    def test_verify_signature_wrong_secret(self):
        payload = b'{"event":"test"}'
        sig = compute_signature(payload, "correct-secret")
        assert verify_signature(payload, "wrong-secret", sig) is False


# ---------------------------------------------------------------------------
# Event payload unit tests
# ---------------------------------------------------------------------------


class TestEventPayload:
    def test_build_event_payload_structure(self):
        payload = build_event_payload(
            event_type="prediction.created",
            data={"matchId": "m-001"},
            webhook_id="wh_abc",
        )
        assert payload["event"] == "prediction.created"
        assert payload["data"] == {"matchId": "m-001"}
        assert payload["webhookId"] == "wh_abc"
        assert "timestamp" in payload

    def test_valid_events_set(self):
        assert "prediction.created" in VALID_EVENTS
        assert "script.generated" in VALID_EVENTS
        assert "overlay.exported" in VALID_EVENTS
        assert len(VALID_EVENTS) == 3


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_webhook(client):
    """POST /api/webhooks creates a new webhook subscription."""
    resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["url"] == "https://example.com/hook"
    assert data["events"] == ["prediction.created"]
    assert data["active"] is True
    assert data["webhookId"].startswith("wh_")
    # Secret must NOT be in the response
    assert "secret" not in data


@pytest.mark.asyncio
async def test_register_webhook_multiple_events(client):
    """Webhook can subscribe to multiple event types."""
    resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created", "script.generated", "overlay.exported"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["events"]) == 3


@pytest.mark.asyncio
async def test_register_webhook_invalid_event_type(client):
    """Invalid event types are rejected with 400."""
    resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created", "invalid.event"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "invalid.event" in str(data)


@pytest.mark.asyncio
async def test_register_webhook_short_secret(client):
    """Secret must be at least 8 characters."""
    resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created"],
            "secret": "short",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 422  # Pydantic validation error


@pytest.mark.asyncio
async def test_register_webhook_empty_events(client):
    """Events list must not be empty."""
    resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": [],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_webhooks_empty(client):
    """GET /api/webhooks returns empty list when no webhooks exist."""
    resp = await client.get("/api/webhooks", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert data["webhooks"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_webhooks(client):
    """GET /api/webhooks returns all registered webhooks."""
    await client.post(
        "/api/webhooks",
        json={
            "url": "https://a.com/hook",
            "events": ["prediction.created"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    await client.post(
        "/api/webhooks",
        json={
            "url": "https://b.com/hook",
            "events": ["script.generated"],
            "secret": "test-secret-key-5678",
        },
        headers=_auth_header(),
    )

    resp = await client.get("/api/webhooks", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    urls = {w["url"] for w in data["webhooks"]}
    assert urls == {"https://a.com/hook", "https://b.com/hook"}


@pytest.mark.asyncio
async def test_delete_webhook(client):
    """DELETE /api/webhooks/{id} removes a webhook."""
    create_resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    webhook_id = create_resp.json()["webhookId"]

    del_resp = await client.delete(
        f"/api/webhooks/{webhook_id}", headers=_auth_header()
    )
    assert del_resp.status_code == 204

    list_resp = await client.get("/api/webhooks", headers=_auth_header())
    assert list_resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_delete_webhook_not_found(client):
    """DELETE /api/webhooks/{id} returns 404 for unknown ID."""
    resp = await client.delete(
        "/api/webhooks/wh_nonexistent", headers=_auth_header()
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_test_webhook_not_found(client):
    """POST /api/webhooks/{id}/test returns 404 for unknown webhook."""
    resp = await client.post(
        "/api/webhooks/wh_nonexistent/test", headers=_auth_header()
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_test_webhook_delivery(client):
    """POST /api/webhooks/{id}/test sends a test event."""
    create_resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://httpbin.org/post",
            "events": ["prediction.created"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    webhook_id = create_resp.json()["webhookId"]

    with patch("app.webhooks.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = '{"ok": true}'

        mock_context = AsyncMock()
        mock_context.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_context)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=None)

        resp = await client.post(
            f"/api/webhooks/{webhook_id}/test", headers=_auth_header()
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["webhookId"] == webhook_id
    assert data["status"] == "delivered"
    assert data["statusCode"] == 200


@pytest.mark.asyncio
async def test_list_webhook_deliveries_empty(client):
    """GET /api/webhooks/{id}/deliveries returns empty list initially."""
    create_resp = await client.post(
        "/api/webhooks",
        json={
            "url": "https://example.com/hook",
            "events": ["prediction.created"],
            "secret": "test-secret-key-1234",
        },
        headers=_auth_header(),
    )
    webhook_id = create_resp.json()["webhookId"]

    resp = await client.get(
        f"/api/webhooks/{webhook_id}/deliveries", headers=_auth_header()
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data == []


@pytest.mark.asyncio
async def test_list_webhook_deliveries_not_found(client):
    """GET /api/webhooks/{id}/deliveries returns 404 for unknown webhook."""
    resp = await client.get(
        "/api/webhooks/wh_nonexistent/deliveries", headers=_auth_header()
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Database-level webhook CRUD tests
# ---------------------------------------------------------------------------


class TestWebhookDB:
    def test_save_and_get_webhook(self):
        db = get_db()
        webhook = db.save_webhook(
            url="https://example.com/hook",
            events=["prediction.created"],
            secret="my-secret-1234",
        )
        assert webhook["webhookId"].startswith("wh_")
        assert webhook["url"] == "https://example.com/hook"
        assert webhook["events"] == ["prediction.created"]
        assert webhook["active"] is True

        retrieved = db.get_webhook(webhook["webhookId"])
        assert retrieved is not None
        assert retrieved["url"] == webhook["url"]

    def test_get_webhook_not_found(self):
        db = get_db()
        assert db.get_webhook("wh_nonexistent") is None

    def test_list_webhooks(self):
        db = get_db()
        db.save_webhook("https://a.com", ["prediction.created"], "secret-a-1234")
        db.save_webhook("https://b.com", ["script.generated"], "secret-b-1234")
        webhooks = db.list_webhooks()
        assert len(webhooks) == 2

    def test_delete_webhook(self):
        db = get_db()
        webhook = db.save_webhook(
            "https://example.com", ["prediction.created"], "secret-1234"
        )
        assert db.delete_webhook(webhook["webhookId"]) is True
        assert db.get_webhook(webhook["webhookId"]) is None

    def test_delete_webhook_not_found(self):
        db = get_db()
        assert db.delete_webhook("wh_nonexistent") is False

    def test_get_active_webhooks_for_event(self):
        db = get_db()
        db.save_webhook("https://a.com", ["prediction.created"], "secret-a-1234")
        db.save_webhook("https://b.com", ["script.generated"], "secret-b-1234")
        db.save_webhook(
            "https://c.com",
            ["prediction.created", "script.generated"],
            "secret-c-1234",
        )

        hooks = db.get_active_webhooks_for_event("prediction.created")
        assert len(hooks) == 2
        urls = {h["url"] for h in hooks}
        assert urls == {"https://a.com", "https://c.com"}

    def test_get_active_webhooks_excludes_inactive(self):
        db = get_db()
        webhook = db.save_webhook(
            "https://example.com", ["prediction.created"], "secret-1234"
        )
        with db._connect() as conn:
            conn.execute(
                "UPDATE webhooks SET active = 0 WHERE webhook_id = ?",
                (webhook["webhookId"],),
            )

        hooks = db.get_active_webhooks_for_event("prediction.created")
        assert len(hooks) == 0


# ---------------------------------------------------------------------------
# Webhook delivery DB tests
# ---------------------------------------------------------------------------


class TestWebhookDeliveryDB:
    def test_save_and_list_deliveries(self):
        db = get_db()
        webhook = db.save_webhook(
            "https://example.com", ["prediction.created"], "secret-1234"
        )

        delivery = db.save_webhook_delivery(
            webhook_id=webhook["webhookId"],
            event_type="prediction.created",
            payload={"event": "prediction.created", "data": {}},
            status="delivered",
            status_code=200,
            attempt=1,
        )
        assert delivery["deliveryId"].startswith("wd_")
        assert delivery["status"] == "delivered"

        deliveries = db.list_webhook_deliveries(webhook["webhookId"])
        assert len(deliveries) == 1
        assert deliveries[0]["eventType"] == "prediction.created"

    def test_update_delivery_status(self):
        db = get_db()
        webhook = db.save_webhook(
            "https://example.com", ["prediction.created"], "secret-1234"
        )
        delivery = db.save_webhook_delivery(
            webhook_id=webhook["webhookId"],
            event_type="prediction.created",
            payload={},
        )

        updated = db.update_webhook_delivery(
            delivery_id=delivery["deliveryId"],
            status="failed",
            status_code=500,
            response="Internal Server Error",
            attempt=2,
        )
        assert updated is True

        deliveries = db.list_webhook_deliveries(webhook["webhookId"])
        assert deliveries[0]["status"] == "failed"
        assert deliveries[0]["statusCode"] == 500
        assert deliveries[0]["attempt"] == 2

    def test_update_delivery_not_found(self):
        db = get_db()
        assert db.update_webhook_delivery("wd_nonexistent", "failed") is False

    def test_delete_webhook_cascades_deliveries(self):
        db = get_db()
        webhook = db.save_webhook(
            "https://example.com", ["prediction.created"], "secret-1234"
        )
        db.save_webhook_delivery(
            webhook_id=webhook["webhookId"],
            event_type="prediction.created",
            payload={},
        )

        db.delete_webhook(webhook["webhookId"])
        deliveries = db.list_webhook_deliveries(webhook["webhookId"])
        assert len(deliveries) == 0


# ---------------------------------------------------------------------------
# Dispatch / delivery integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dispatch_event_delivers_to_subscribed_webhooks():
    """dispatch_event sends payloads to all matching webhooks."""
    from app.webhooks import dispatch_event

    db = get_db()
    db.save_webhook(
        "https://example.com/hook",
        ["prediction.created"],
        "test-secret-key-1234",
    )

    with patch("app.webhooks.deliver_webhook", new_callable=AsyncMock) as mock_deliver:
        mock_deliver.return_value = {
            "status": "delivered",
            "statusCode": 200,
            "attempt": 1,
        }
        results = await dispatch_event(
            "prediction.created",
            {"matchId": "m-001", "homeWin": 45},
        )

    assert len(results) == 1
    assert results[0]["status"] == "delivered"
    mock_deliver.assert_called_once()


@pytest.mark.asyncio
async def test_dispatch_event_skips_unsubscribed_webhooks():
    """dispatch_event skips webhooks not subscribed to the event."""
    from app.webhooks import dispatch_event

    db = get_db()
    db.save_webhook(
        "https://example.com/hook",
        ["script.generated"],
        "test-secret-key-1234",
    )

    with patch("app.webhooks.deliver_webhook", new_callable=AsyncMock) as mock_deliver:
        results = await dispatch_event(
            "prediction.created",
            {"matchId": "m-001"},
        )

    assert len(results) == 0
    mock_deliver.assert_not_called()


@pytest.mark.asyncio
async def test_dispatch_event_ignores_unknown_event_types():
    """Unknown event types produce no deliveries."""
    from app.webhooks import dispatch_event

    db = get_db()
    db.save_webhook(
        "https://example.com/hook",
        ["*"],
        "test-secret-key-1234",
    )

    results = await dispatch_event("unknown.event", {"data": True})
    assert results == []


@pytest.mark.asyncio
async def test_deliver_webhook_sends_correct_headers():
    """Verify the delivery includes expected HMAC headers."""
    from app.webhooks import deliver_webhook, build_event_payload

    db = get_db()
    webhook = db.save_webhook(
        "https://example.com/hook",
        ["prediction.created"],
        "test-secret-key-1234",
    )

    payload = build_event_payload(
        "prediction.created",
        {"matchId": "m-001"},
        webhook_id=webhook["webhookId"],
    )

    with patch("app.webhooks.httpx.AsyncClient") as mock_client:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = "OK"

        mock_context = AsyncMock()
        mock_context.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_context)
        mock_client.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await deliver_webhook(webhook, "prediction.created", payload)

    assert result["status"] == "delivered"

    call_kwargs = mock_context.post.call_args
    headers = call_kwargs.kwargs.get("headers", {})
    assert "X-LineupCast-Event" in headers
    assert headers["X-LineupCast-Event"] == "prediction.created"
    assert "X-LineupCast-Signature" in headers
    assert headers["X-LineupCast-Signature"].startswith("sha256=")

    payload_bytes = json.dumps(payload, default=str, separators=(",", ":")).encode(
        "utf-8"
    )
    sig = headers["X-LineupCast-Signature"].removeprefix("sha256=")
    assert verify_signature(payload_bytes, "test-secret-key-1234", sig)
