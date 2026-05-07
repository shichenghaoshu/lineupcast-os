"""Auth, workspace, and API-key service backed by SQLite.

All sensitive values (tokens, API keys) are hashed before storage.
Raw tokens and keys are never logged or returned in full.
"""

from __future__ import annotations

import hashlib
import json
import logging
import secrets
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings
from .db import Database, get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DEV_USER_ID = "dev-user-0001"
_DEV_EMAIL = "dev@lineupcast.local"
_DEV_DISPLAY_NAME = "Dev User"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_api_key() -> tuple[str, str, str]:
    """Return (raw_key, key_hash, key_prefix).

    *raw_key* is only returned once to the caller.
    *key_hash* (SHA-256) is stored in the database.
    *key_prefix* is a human-friendly identifier (first 8 chars).
    """
    raw = f"lc_{secrets.token_urlsafe(32)}"
    return raw, _hash_token(raw), raw[:11]


def _mask_key(key_prefix: str) -> str:
    """Return a masked representation like ``lc_abc12345...********``."""
    return f"{key_prefix}...********"


# ---------------------------------------------------------------------------
# DB helpers (auth tables)
# ---------------------------------------------------------------------------


def _get_or_create_user(
    db: Database,
    user_id: str,
    email: str,
    display_name: str,
    *,
    is_dev: bool = False,
) -> dict:
    """Fetch a user row or insert a new one.  Returns the user dict."""
    now = _now_iso()
    with db._connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row:
            return {
                "userId": row["user_id"],
                "email": row["email"],
                "displayName": row["display_name"],
                "avatarUrl": row["avatar_url"],
                "isDev": bool(row["is_dev"]),
                "createdAt": row["created_at"],
            }
        conn.execute(
            "INSERT INTO users (user_id, email, display_name, is_dev, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, email, display_name, 1 if is_dev else 0, now, now),
        )
    return {
        "userId": user_id,
        "email": email,
        "displayName": display_name,
        "avatarUrl": None,
        "isDev": is_dev,
        "createdAt": now,
    }


def _save_dev_token(db: Database, user_id: str, token_hash: str) -> None:
    """Persist a dev-login token hash so get_current_user can look it up."""
    now = _now_iso()
    with db._connect() as conn:
        # Reuse the api_keys table with a special workspace "__dev__"
        conn.execute(
            "INSERT OR IGNORE INTO workspaces "
            "(workspace_id, name, slug, owner_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            ("__dev__", "Dev Workspace", "__dev__", user_id, now, now),
        )
        conn.execute(
            "INSERT OR IGNORE INTO workspace_members "
            "(workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            ("__dev__", user_id, "owner", now),
        )
        prefix = token_hash[:11]
        conn.execute(
            "INSERT INTO api_keys "
            "(key_id, workspace_id, name, key_hash, key_prefix, scopes, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (f"devkey_{uuid4().hex[:8]}", "__dev__", "dev-token", token_hash, prefix, json.dumps(["*"]), 1, now, now),
        )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def dev_login(db: Database | None = None) -> dict:
    """Create (or reuse) a dev user and return a token.

    Only callable when ``dev_mode`` is enabled.
    """
    db = db or get_db()
    user = _get_or_create_user(db, _DEV_USER_ID, _DEV_EMAIL, _DEV_DISPLAY_NAME, is_dev=True)
    raw_token = f"dev_{secrets.token_urlsafe(32)}"
    _save_dev_token(db, _DEV_USER_ID, _hash_token(raw_token))
    return {"user": user, "token": raw_token}


def get_current_user(
    token: str,
    db: Database | None = None,
) -> dict:
    """Validate a bearer token and return the associated user dict.

    Raises ``HTTPException(401)`` on failure.
    """
    db = db or get_db()
    token_hash = _hash_token(token)
    with db._connect() as conn:
        row = conn.execute(
            "SELECT u.* FROM api_keys ak "
            "JOIN workspace_members wm ON ak.workspace_id = wm.workspace_id "
            "JOIN users u ON wm.user_id = u.user_id "
            "WHERE ak.key_hash = ? AND ak.is_active = 1 "
            "LIMIT 1",
            (token_hash,),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        # Update last_used_at (fire-and-forget)
        conn.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?",
            (_now_iso(), token_hash),
        )
        return {
            "userId": row["user_id"],
            "email": row["email"],
            "displayName": row["display_name"],
            "avatarUrl": row["avatar_url"],
            "isDev": bool(row["is_dev"]),
        }


def create_workspace(
    name: str,
    slug: str,
    owner_id: str,
    db: Database | None = None,
) -> dict:
    """Create a new workspace with *owner_id* as the owner."""
    db = db or get_db()
    ws_id = f"ws_{uuid4().hex[:12]}"
    now = _now_iso()
    with db._connect() as conn:
        existing = conn.execute(
            "SELECT workspace_id FROM workspaces WHERE slug = ?", (slug,)
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Workspace slug '{slug}' already exists",
            )
        conn.execute(
            "INSERT INTO workspaces (workspace_id, name, slug, owner_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (ws_id, name, slug, owner_id, now, now),
        )
        conn.execute(
            "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) "
            "VALUES (?, ?, ?, ?)",
            (ws_id, owner_id, "owner", now),
        )
    return {
        "workspaceId": ws_id,
        "name": name,
        "slug": slug,
        "ownerId": owner_id,
        "createdAt": now,
    }


def get_workspace(workspace_id: str, db: Database | None = None) -> dict | None:
    """Fetch a workspace by id or ``None``."""
    db = db or get_db()
    with db._connect() as conn:
        row = conn.execute(
            "SELECT * FROM workspaces WHERE workspace_id = ?", (workspace_id,)
        ).fetchone()
        if row is None:
            return None
        return {
            "workspaceId": row["workspace_id"],
            "name": row["name"],
            "slug": row["slug"],
            "ownerId": row["owner_id"],
            "createdAt": row["created_at"],
        }


def list_workspaces(user_id: str, db: Database | None = None) -> list[dict]:
    """Return all workspaces the user belongs to."""
    db = db or get_db()
    with db._connect() as conn:
        rows = conn.execute(
            "SELECT w.*, wm.role FROM workspaces w "
            "JOIN workspace_members wm ON w.workspace_id = wm.workspace_id "
            "WHERE wm.user_id = ? ORDER BY w.created_at DESC",
            (user_id,),
        ).fetchall()
        return [
            {
                "workspaceId": r["workspace_id"],
                "name": r["name"],
                "slug": r["slug"],
                "ownerId": r["owner_id"],
                "role": r["role"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]


def add_workspace_member(
    workspace_id: str,
    user_id: str,
    role: str = "member",
    db: Database | None = None,
) -> dict:
    """Add *user_id* to *workspace_id* with the given *role*."""
    db = db or get_db()
    now = _now_iso()
    with db._connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO workspace_members "
            "(workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            (workspace_id, user_id, role, now),
        )
    return {"workspaceId": workspace_id, "userId": user_id, "role": role}


def create_api_key(
    workspace_id: str,
    name: str,
    scopes: list[str] | None = None,
    db: Database | None = None,
) -> tuple[dict, str]:
    """Create an API key for a workspace.

    Returns ``(key_info_dict, raw_key)``.  *raw_key* is shown to the user
    exactly once and is never stored or logged.
    """
    db = db or get_db()
    raw_key, key_hash, key_prefix = _generate_api_key()
    key_id = f"ak_{uuid4().hex[:12]}"
    now = _now_iso()
    with db._connect() as conn:
        conn.execute(
            "INSERT INTO api_keys "
            "(key_id, workspace_id, name, key_hash, key_prefix, scopes, is_active, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (key_id, workspace_id, name, key_hash, key_prefix, json.dumps(scopes or []), 1, now, now),
        )
    info = {
        "keyId": key_id,
        "workspaceId": workspace_id,
        "name": name,
        "keyPrefix": key_prefix,
        "maskedKey": _mask_key(key_prefix),
        "scopes": scopes or [],
        "createdAt": now,
    }
    return info, raw_key


def validate_api_key(
    key_hash: str,
    db: Database | None = None,
) -> dict | None:
    """Validate a key hash and return the associated workspace dict, or ``None``."""
    db = db or get_db()
    with db._connect() as conn:
        row = conn.execute(
            "SELECT w.*, ak.scopes FROM api_keys ak "
            "JOIN workspaces w ON ak.workspace_id = w.workspace_id "
            "WHERE ak.key_hash = ? AND ak.is_active = 1",
            (key_hash,),
        ).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?",
            (_now_iso(), key_hash),
        )
        return {
            "workspaceId": row["workspace_id"],
            "name": row["name"],
            "slug": row["slug"],
            "ownerId": row["owner_id"],
            "scopes": json.loads(row["scopes"]),
        }


def list_api_keys(
    workspace_id: str,
    db: Database | None = None,
) -> list[dict]:
    """List all API keys for a workspace (masked, no hashes)."""
    db = db or get_db()
    with db._connect() as conn:
        rows = conn.execute(
            "SELECT * FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC",
            (workspace_id,),
        ).fetchall()
        return [
            {
                "keyId": r["key_id"],
                "name": r["name"],
                "keyPrefix": r["key_prefix"],
                "maskedKey": _mask_key(r["key_prefix"]),
                "scopes": json.loads(r["scopes"]),
                "isActive": bool(r["is_active"]),
                "lastUsedAt": r["last_used_at"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]


def delete_api_key(
    workspace_id: str,
    key_id: str,
    db: Database | None = None,
) -> bool:
    """Soft-delete an API key. Returns ``True`` if it existed."""
    db = db or get_db()
    with db._connect() as conn:
        cursor = conn.execute(
            "UPDATE api_keys SET is_active = 0, updated_at = ? "
            "WHERE key_id = ? AND workspace_id = ?",
            (_now_iso(), key_id, workspace_id),
        )
        return cursor.rowcount > 0


def get_workspace_usage(
    workspace_id: str,
    db: Database | None = None,
) -> dict:
    """Return basic usage stats for a workspace."""
    db = db or get_db()
    with db._connect() as conn:
        member_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM workspace_members WHERE workspace_id = ?",
            (workspace_id,),
        ).fetchone()["cnt"]
        key_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM api_keys WHERE workspace_id = ? AND is_active = 1",
            (workspace_id,),
        ).fetchone()["cnt"]
        match_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM matches",
        ).fetchone()["cnt"]
        prediction_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM predictions",
        ).fetchone()["cnt"]
    return {
        "workspaceId": workspace_id,
        "members": member_count,
        "activeApiKeys": key_count,
        "totalMatches": match_count,
        "totalPredictions": prediction_count,
    }


def update_workspace(
    workspace_id: str,
    name: str,
    db: Database | None = None,
) -> dict | None:
    """Update a workspace name. Returns the updated workspace dict or ``None``."""
    db = db or get_db()
    now = _now_iso()
    with db._connect() as conn:
        cursor = conn.execute(
            "UPDATE workspaces SET name = ?, updated_at = ? WHERE workspace_id = ?",
            (name, now, workspace_id),
        )
        if cursor.rowcount == 0:
            return None
        row = conn.execute(
            "SELECT * FROM workspaces WHERE workspace_id = ?", (workspace_id,)
        ).fetchone()
    return {
        "workspaceId": row["workspace_id"],
        "name": row["name"],
        "slug": row["slug"],
        "ownerId": row["owner_id"],
        "createdAt": row["created_at"],
    }


def list_workspace_members(
    workspace_id: str,
    db: Database | None = None,
) -> list[dict]:
    """Return all members of a workspace with user details."""
    db = db or get_db()
    with db._connect() as conn:
        rows = conn.execute(
            "SELECT u.user_id, u.email, u.display_name, u.avatar_url, u.is_dev, wm.role, wm.created_at "
            "FROM workspace_members wm "
            "JOIN users u ON wm.user_id = u.user_id "
            "WHERE wm.workspace_id = ? ORDER BY wm.created_at ASC",
            (workspace_id,),
        ).fetchall()
        return [
            {
                "userId": r["user_id"],
                "email": r["email"],
                "displayName": r["display_name"],
                "avatarUrl": r["avatar_url"],
                "isDev": bool(r["is_dev"]),
                "role": r["role"],
                "joinedAt": r["created_at"],
            }
            for r in rows
        ]


def get_user_by_id(
    user_id: str,
    db: Database | None = None,
) -> dict | None:
    """Fetch a user by id or ``None``."""
    db = db or get_db()
    with db._connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return None
        return {
            "userId": row["user_id"],
            "email": row["email"],
            "displayName": row["display_name"],
            "avatarUrl": row["avatar_url"],
            "isDev": bool(row["is_dev"]),
            "createdAt": row["created_at"],
        }


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


async def get_current_user_dep(
    authorization: str | None = Header(None),
    settings: Settings = Depends(get_settings),
) -> dict:
    """FastAPI dependency that extracts and validates the bearer token.

    In dev_mode the dependency is optional: if no token is provided a
    synthetic dev user is returned so local demos work without auth.
    """
    if not authorization or not authorization.startswith("Bearer "):
        if settings.dev_mode:
            return {
                "userId": _DEV_USER_ID,
                "email": _DEV_EMAIL,
                "displayName": _DEV_DISPLAY_NAME,
                "avatarUrl": None,
                "isDev": True,
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = authorization[7:]
    return get_current_user(token)
