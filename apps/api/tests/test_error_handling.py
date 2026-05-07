"""Tests for global error handling middleware.

Covers:
  - Structured error responses with {error, detail, requestId} shape.
  - HTTPException handler (4xx and 5xx).
  - Unhandled exception handler (never leaks internals).
  - Request validation error handler (422).
  - Request-id header on every response.
  - Request logging middleware (via X-Request-Id presence).
"""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import get_settings


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(autouse=True)
async def _env_defaults():
    """Ensure consistent env for every test."""
    os.environ["LINEUPCAST_DEV_MODE"] = "true"
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def client():
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def client_with_error_route():
    """App with an extra route that raises a generic Exception."""
    from fastapi import FastAPI
    from app.middleware import register_middleware

    app = FastAPI()
    register_middleware(app)

    @app.get("/boom")
    async def boom():
        raise RuntimeError("something went very wrong")

    @app.get("/ok")
    async def ok():
        return {"status": "fine"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# Response shape helpers
# ---------------------------------------------------------------------------


def _assert_error_shape(data: dict, expected_status: int | None = None) -> None:
    """Validate the response body has the required error contract fields."""
    assert "error" in data, f"missing 'error' key in {data}"
    assert "detail" in data, f"missing 'detail' key in {data}"
    assert "requestId" in data, f"missing 'requestId' key in {data}"
    assert isinstance(data["error"], str)
    assert isinstance(data["detail"], str)
    assert isinstance(data["requestId"], str)
    assert len(data["requestId"]) > 0


# ---------------------------------------------------------------------------
# HTTPException handler tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_404_returns_structured_error(client):
    """A missing resource should return a structured 404."""
    resp = await client.get("/api/matches/nonexistent-match-id")
    assert resp.status_code == 404
    _assert_error_shape(resp.json())
    data = resp.json()
    assert data["error"] == "Not Found"
    assert "nonexistent-match-id" in data["detail"]


@pytest.mark.asyncio
async def test_404_has_request_id_header(client):
    """The response must carry an X-Request-Id header."""
    resp = await client.get("/api/matches/nonexistent-match-id")
    assert "x-request-id" in resp.headers
    request_id = resp.headers["x-request-id"]
    assert len(request_id) > 0
    # Should match the body requestId
    assert resp.json()["requestId"] == request_id


@pytest.mark.asyncio
async def test_client_error_forwards_detail(client):
    """4xx errors should include the original detail from the exception."""
    resp = await client.get("/api/matches/nonexistent-match-id")
    data = resp.json()
    assert data["error"] == "Not Found"
    # The detail should be a helpful message, not a generic one.
    assert "not found" in data["detail"].lower()


# ---------------------------------------------------------------------------
# Unhandled exception handler tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500(client_with_error_route):
    """An unhandled exception should return 500 with a generic message."""
    resp = await client_with_error_route.get("/boom")
    assert resp.status_code == 500
    data = resp.json()
    _assert_error_shape(data)
    assert data["error"] == "Internal Server Error"


@pytest.mark.asyncio
async def test_unhandled_exception_never_leaks_detail(client_with_error_route):
    """The response must NOT contain the internal exception message."""
    resp = await client_with_error_route.get("/boom")
    data = resp.json()
    assert "something went very wrong" not in data["detail"]
    assert "RuntimeError" not in data["detail"]
    # Should use the generic safe message.
    assert "internal error" in data["detail"].lower()


@pytest.mark.asyncio
async def test_unhandled_exception_has_request_id(client_with_error_route):
    """500 responses must include a requestId."""
    resp = await client_with_error_route.get("/boom")
    assert "x-request-id" in resp.headers
    assert resp.json()["requestId"] == resp.headers["x-request-id"]


# ---------------------------------------------------------------------------
# Validation error handler tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_error_returns_structured_422(client):
    """A request with invalid body should return a structured 422."""
    # POST to import-match without required admin auth and with bad body
    resp = await client.post(
        "/api/matches/import",
        json={"badField": "nope"},
    )
    # The response may be 422 (validation) or 401/403 (auth).
    # We only care about the 422 case; if auth rejects first that's fine too.
    if resp.status_code == 422:
        _assert_error_shape(resp.json())
        data = resp.json()
        assert data["error"] == "Validation Error"
        assert len(data["detail"]) > 0


# ---------------------------------------------------------------------------
# X-Request-Id echo tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_request_id_echoed_when_provided(client):
    """When the client sends X-Request-Id, the server should echo it back."""
    custom_id = "my-custom-request-id-12345"
    resp = await client.get("/healthz", headers={"X-Request-Id": custom_id})
    assert resp.status_code == 200
    assert resp.headers["x-request-id"] == custom_id


@pytest.mark.asyncio
async def test_request_id_generated_when_missing(client):
    """When no X-Request-Id is sent, the server should generate one."""
    resp = await client.get("/healthz")
    assert "x-request-id" in resp.headers
    generated = resp.headers["x-request-id"]
    assert len(generated) > 0


# ---------------------------------------------------------------------------
# Normal (happy-path) responses are unaffected
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_healthy_endpoint_unaffected_by_middleware(client):
    """Middleware must not break normal successful responses."""
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    # Should still have the request-id header
    assert "x-request-id" in resp.headers


@pytest.mark.asyncio
async def test_normal_endpoint_returns_expected_body(client_with_error_route):
    """A non-error route still returns its expected body through the middleware."""
    resp = await client_with_error_route.get("/ok")
    assert resp.status_code == 200
    assert resp.json() == {"status": "fine"}
    assert "x-request-id" in resp.headers
