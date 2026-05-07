"""Auth and workspace routes for the LineupCast API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import (
    add_workspace_member,
    create_api_key,
    create_workspace,
    delete_api_key,
    dev_login,
    get_current_user_dep,
    get_workspace,
    get_workspace_usage,
    list_api_keys,
    list_workspace_members,
    list_workspaces,
    update_workspace,
)
from ..config import Settings, get_settings
from ..db import get_db

router = APIRouter(tags=["auth"])


# ---------------------------------------------------------------------------
# Request / response schemas (local to this module)
# ---------------------------------------------------------------------------


class DevLoginResponse(BaseModel):
    user: dict
    token: str


class UserResponse(BaseModel):
    userId: str
    email: str
    displayName: str
    avatarUrl: str | None = None
    isDev: bool = False


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9\-]*$")


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class WorkspaceResponse(BaseModel):
    workspaceId: str
    name: str
    slug: str
    ownerId: str
    role: str | None = None
    createdAt: str


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]
    total: int


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    scopes: list[str] = Field(default_factory=list)


class ApiKeyResponse(BaseModel):
    keyId: str
    name: str
    keyPrefix: str
    maskedKey: str
    scopes: list[str] = Field(default_factory=list)
    isActive: bool = True
    lastUsedAt: str | None = None
    createdAt: str


class ApiKeyCreateResponse(BaseModel):
    key: ApiKeyResponse
    rawKey: str = Field(description="Shown only once. Store it securely.")


class ApiKeyListResponse(BaseModel):
    keys: list[ApiKeyResponse]
    total: int


class WorkspaceUsageResponse(BaseModel):
    workspaceId: str
    members: int
    activeApiKeys: int
    totalMatches: int
    totalPredictions: int


class MemberResponse(BaseModel):
    userId: str
    email: str
    displayName: str
    avatarUrl: str | None = None
    isDev: bool = False
    role: str
    joinedAt: str


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/api/auth/dev-login", response_model=DevLoginResponse)
async def auth_dev_login(settings: Settings = Depends(get_settings)):
    """Dev-only login that returns a token for local demos.

    Only available when ``LINEUPCAST_DEV_MODE`` is enabled.
    """
    if not settings.dev_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev login is disabled in production mode",
        )
    db = get_db()
    result = dev_login(db)
    return DevLoginResponse(user=result["user"], token=result["token"])


@router.get("/api/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user_dep)):
    """Return the current authenticated user."""
    return UserResponse(**user)


@router.get("/api/workspaces", response_model=WorkspaceListResponse)
async def list_my_workspaces(user: dict = Depends(get_current_user_dep)):
    """List all workspaces the current user belongs to."""
    db = get_db()
    ws_list = list_workspaces(user["userId"], db)
    return WorkspaceListResponse(
        workspaces=[WorkspaceResponse(**ws) for ws in ws_list],
        total=len(ws_list),
    )


@router.post(
    "/api/workspaces",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_workspace(
    payload: WorkspaceCreate,
    user: dict = Depends(get_current_user_dep),
):
    """Create a new workspace.  The current user becomes the owner."""
    db = get_db()
    ws = create_workspace(payload.name, payload.slug, user["userId"], db)
    return WorkspaceResponse(**ws)


@router.get(
    "/api/workspaces/{workspace_id}/usage",
    response_model=WorkspaceUsageResponse,
)
async def workspace_usage(
    workspace_id: str,
    user: dict = Depends(get_current_user_dep),
):
    """Return usage stats for a workspace."""
    db = get_db()
    ws = get_workspace(workspace_id, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    usage = get_workspace_usage(workspace_id, db)
    return WorkspaceUsageResponse(**usage)


@router.patch(
    "/api/workspaces/{workspace_id}",
    response_model=WorkspaceResponse,
)
async def update_workspace_name(
    workspace_id: str,
    payload: WorkspaceUpdate,
    user: dict = Depends(get_current_user_dep),
):
    """Update a workspace name."""
    db = get_db()
    ws = update_workspace(workspace_id, payload.name, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return WorkspaceResponse(**ws)


@router.get(
    "/api/workspaces/{workspace_id}/members",
    response_model=MemberListResponse,
)
async def list_workspace_members_route(
    workspace_id: str,
    user: dict = Depends(get_current_user_dep),
):
    """List all members of a workspace."""
    db = get_db()
    ws = get_workspace(workspace_id, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    members = list_workspace_members(workspace_id, db)
    return MemberListResponse(
        members=[MemberResponse(**m) for m in members],
        total=len(members),
    )


@router.post(
    "/api/workspaces/{workspace_id}/api-keys",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_workspace_api_key(
    workspace_id: str,
    payload: ApiKeyCreate,
    user: dict = Depends(get_current_user_dep),
):
    """Create a new API key for a workspace.

    The raw key is returned **once** in the response.
    """
    db = get_db()
    ws = get_workspace(workspace_id, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    info, raw_key = create_api_key(workspace_id, payload.name, payload.scopes, db)
    return ApiKeyCreateResponse(
        key=ApiKeyResponse(**info),
        rawKey=raw_key,
    )


@router.get(
    "/api/workspaces/{workspace_id}/api-keys",
    response_model=ApiKeyListResponse,
)
async def list_workspace_api_keys(
    workspace_id: str,
    user: dict = Depends(get_current_user_dep),
):
    """List all (active) API keys for a workspace (masked)."""
    db = get_db()
    ws = get_workspace(workspace_id, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    keys = list_api_keys(workspace_id, db)
    return ApiKeyListResponse(
        keys=[ApiKeyResponse(**k) for k in keys],
        total=len(keys),
    )


@router.delete(
    "/api/workspaces/{workspace_id}/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_workspace_api_key(
    workspace_id: str,
    key_id: str,
    user: dict = Depends(get_current_user_dep),
):
    """Soft-delete an API key."""
    db = get_db()
    ws = get_workspace(workspace_id, db)
    if ws is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    deleted = delete_api_key(workspace_id, key_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")
