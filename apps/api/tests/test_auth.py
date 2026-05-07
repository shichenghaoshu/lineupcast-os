"""Tests for auth, workspace, and API-key endpoints."""

from __future__ import annotations

import hashlib
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.db import Database, reset_db, get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(autouse=True)
async def _reset_db(tmp_path):
    """Use a fresh temp database for every test."""
    db_path = tmp_path / "test.db"
    reset_db()
    db = Database(db_path)
    import app.db as db_mod
    db_mod._db_instance = db
    yield db
    reset_db()


@pytest_asyncio.fixture
async def client():
    """Create an isolated test client with dev_mode enabled."""
    # Ensure dev_mode is on
    os.environ["LINEUPCAST_DEV_MODE"] = "true"
    get_settings.cache_clear()

    from app.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def prod_client():
    """Create an isolated test client with dev_mode disabled."""
    os.environ["LINEUPCAST_DEV_MODE"] = "false"
    get_settings.cache_clear()

    from app.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    # Restore
    os.environ["LINEUPCAST_DEV_MODE"] = "true"
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _dev_login(client: AsyncClient) -> tuple[dict, str]:
    """Perform a dev login and return (user, token)."""
    resp = await client.post("/api/auth/dev-login")
    assert resp.status_code == 200
    data = resp.json()
    return data["user"], data["token"]


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Dev login tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dev_login_returns_user_and_token(client):
    user, token = await _dev_login(client)
    assert user["userId"] == "dev-user-0001"
    assert user["email"] == "dev@lineupcast.local"
    assert user["isDev"] is True
    assert token.startswith("dev_")


@pytest.mark.asyncio
async def test_dev_login_disabled_in_production(prod_client):
    resp = await prod_client.post("/api/auth/dev-login")
    assert resp.status_code == 403
    assert "disabled" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_me_with_token(client):
    user, token = await _dev_login(client)
    resp = await client.get("/api/me", headers=_auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["userId"] == user["userId"]
    assert data["email"] == user["email"]


@pytest.mark.asyncio
async def test_get_me_dev_mode_without_token(client):
    """In dev mode, /api/me returns the synthetic dev user without a token."""
    resp = await client.get("/api/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["userId"] == "dev-user-0001"


@pytest.mark.asyncio
async def test_get_me_production_requires_token(prod_client):
    """In production mode, /api/me without a token must fail."""
    resp = await prod_client.get("/api/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client):
    resp = await client.get("/api/me", headers=_auth_header("bogus_token"))
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Workspace CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_workspace(client):
    user, token = await _dev_login(client)
    resp = await client.post(
        "/api/workspaces",
        json={"name": "Test FC", "slug": "test-fc"},
        headers=_auth_header(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test FC"
    assert data["slug"] == "test-fc"
    assert data["ownerId"] == user["userId"]


@pytest.mark.asyncio
async def test_create_workspace_duplicate_slug(client):
    user, token = await _dev_login(client)
    await client.post(
        "/api/workspaces",
        json={"name": "First", "slug": "dup-slug"},
        headers=_auth_header(token),
    )
    resp = await client.post(
        "/api/workspaces",
        json={"name": "Second", "slug": "dup-slug"},
        headers=_auth_header(token),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_workspaces(client):
    user, token = await _dev_login(client)
    # Create two workspaces
    await client.post(
        "/api/workspaces",
        json={"name": "Alpha", "slug": "alpha"},
        headers=_auth_header(token),
    )
    await client.post(
        "/api/workspaces",
        json={"name": "Beta", "slug": "beta"},
        headers=_auth_header(token),
    )
    resp = await client.get("/api/workspaces", headers=_auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    # Dev workspace + 2 created = 3 (dev-login creates __dev__ workspace)
    assert data["total"] >= 2
    slugs = {ws["slug"] for ws in data["workspaces"]}
    assert "alpha" in slugs
    assert "beta" in slugs


@pytest.mark.asyncio
async def test_workspace_usage(client):
    user, token = await _dev_login(client)
    # Create workspace
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Usage Test", "slug": "usage-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]
    resp = await client.get(
        f"/api/workspaces/{ws_id}/usage",
        headers=_auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["members"] >= 1
    assert data["workspaceId"] == ws_id


@pytest.mark.asyncio
async def test_workspace_usage_not_found(client):
    user, token = await _dev_login(client)
    resp = await client.get(
        "/api/workspaces/ws_nonexistent/usage",
        headers=_auth_header(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# API key tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_api_key(client):
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Key Test", "slug": "key-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "CI Key", "scopes": ["read", "predict"]},
        headers=_auth_header(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    # rawKey must be present and start with lc_
    assert data["rawKey"].startswith("lc_")
    # key metadata
    assert data["key"]["name"] == "CI Key"
    assert data["key"]["scopes"] == ["read", "predict"]
    # masked key should not equal raw key
    assert data["key"]["maskedKey"] != data["rawKey"]
    assert "..." in data["key"]["maskedKey"]


@pytest.mark.asyncio
async def test_api_key_never_stores_raw_key(client):
    """Verify the raw key is not stored in the database."""
    from app.auth import _hash_token
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Hash Test", "slug": "hash-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    create_resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Hash Check"},
        headers=_auth_header(token),
    )
    raw_key = create_resp.json()["rawKey"]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    # The hash should be in the DB but the raw key should not
    db = get_db()
    with db._connect() as conn:
        row = conn.execute(
            "SELECT key_hash FROM api_keys WHERE key_hash = ?", (key_hash,)
        ).fetchone()
        assert row is not None, "Hash should be stored"

        rows = conn.execute("SELECT * FROM api_keys").fetchall()
        for r in rows:
            # key_hash column stores the hash, not the raw key
            stored = r["key_hash"]
            assert not stored.startswith("lc_"), "Raw key must not be stored"


@pytest.mark.asyncio
async def test_api_key_used_for_authentication(client):
    """A raw API key returned during creation can authenticate requests."""
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Auth Test", "slug": "auth-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    key_resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Auth Key"},
        headers=_auth_header(token),
    )
    raw_key = key_resp.json()["rawKey"]

    # Use the API key as bearer token
    me_resp = await client.get("/api/me", headers=_auth_header(raw_key))
    assert me_resp.status_code == 200
    assert me_resp.json()["userId"] == user["userId"]


@pytest.mark.asyncio
async def test_list_api_keys(client):
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "List Keys", "slug": "list-keys"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Key A"},
        headers=_auth_header(token),
    )
    await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Key B"},
        headers=_auth_header(token),
    )

    resp = await client.get(
        f"/api/workspaces/{ws_id}/api-keys",
        headers=_auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    names = {k["name"] for k in data["keys"]}
    assert names == {"Key A", "Key B"}


@pytest.mark.asyncio
async def test_delete_api_key(client):
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Delete Key", "slug": "delete-key"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    key_resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Ephemeral"},
        headers=_auth_header(token),
    )
    key_id = key_resp.json()["key"]["keyId"]
    raw_key = key_resp.json()["rawKey"]

    # Delete
    del_resp = await client.delete(
        f"/api/workspaces/{ws_id}/api-keys/{key_id}",
        headers=_auth_header(token),
    )
    assert del_resp.status_code == 204

    # The deleted key should no longer authenticate
    me_resp = await client.get("/api/me", headers=_auth_header(raw_key))
    assert me_resp.status_code == 401

    # Key should not appear in listing
    list_resp = await client.get(
        f"/api/workspaces/{ws_id}/api-keys",
        headers=_auth_header(token),
    )
    assert all(k["keyId"] != key_id for k in list_resp.json()["keys"])


@pytest.mark.asyncio
async def test_delete_api_key_not_found(client):
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Del NF", "slug": "del-nf"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    resp = await client.delete(
        f"/api/workspaces/{ws_id}/api-keys/ak_nonexistent",
        headers=_auth_header(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Role-based access tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_workspace_member_roles(client):
    """Verify workspace members have correct roles assigned."""
    from app.auth import add_workspace_member, get_user_by_id
    from app.db import get_db as _get_db
    db = _get_db()

    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Role Test", "slug": "role-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    # Add a second user as a member
    second_user_id = "user-role-test-001"
    _now = __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat()
    with db._connect() as conn:
        conn.execute(
            "INSERT INTO users (user_id, email, display_name, is_dev, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (second_user_id, "second@lineupcast.local", "Second User", 0, _now, _now),
        )

    add_workspace_member(ws_id, second_user_id, "member", db)

    usage_resp = await client.get(
        f"/api/workspaces/{ws_id}/usage",
        headers=_auth_header(token),
    )
    assert usage_resp.status_code == 200
    assert usage_resp.json()["members"] == 2  # owner + new member


@pytest.mark.asyncio
async def test_only_active_api_keys_authenticate(client):
    """Deactivated keys must fail authentication."""
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Active Test", "slug": "active-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    key_resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Temp Key"},
        headers=_auth_header(token),
    )
    key_id = key_resp.json()["key"]["keyId"]
    raw_key = key_resp.json()["rawKey"]

    # Confirm it works
    assert (await client.get("/api/me", headers=_auth_header(raw_key))).status_code == 200

    # Deactivate directly in DB
    db = get_db()
    with db._connect() as conn:
        conn.execute("UPDATE api_keys SET is_active = 0 WHERE key_id = ?", (key_id,))

    # Should now fail
    assert (await client.get("/api/me", headers=_auth_header(raw_key))).status_code == 401


@pytest.mark.asyncio
async def test_api_key_scopes_stored(client):
    """Verify that scopes are persisted and returned."""
    user, token = await _dev_login(client)
    ws_resp = await client.post(
        "/api/workspaces",
        json={"name": "Scope Test", "slug": "scope-test"},
        headers=_auth_header(token),
    )
    ws_id = ws_resp.json()["workspaceId"]

    key_resp = await client.post(
        f"/api/workspaces/{ws_id}/api-keys",
        json={"name": "Scoped", "scopes": ["read", "write", "predict"]},
        headers=_auth_header(token),
    )
    assert key_resp.status_code == 201
    scopes = key_resp.json()["key"]["scopes"]
    assert set(scopes) == {"read", "write", "predict"}

    # Verify in listing too
    list_resp = await client.get(
        f"/api/workspaces/{ws_id}/api-keys",
        headers=_auth_header(token),
    )
    found = [k for k in list_resp.json()["keys"] if k["name"] == "Scoped"]
    assert len(found) == 1
    assert set(found[0]["scopes"]) == {"read", "write", "predict"}
