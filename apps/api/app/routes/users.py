"""User management routes for the LineupCast API.

Provides endpoints for listing, inviting, updating roles, and deactivating
users.  All endpoints require admin authentication when ``LINEUPCAST_ADMIN_TOKEN``
is configured.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..config import Settings
from ..database import get_session
from ..models import User
from ..schemas import (
    UserInviteRequest,
    UserListResponse,
    UserOut,
    UserUpdateRoleRequest,
)
from ..security import require_admin

router = APIRouter(prefix="/api/users", tags=["users"])

logger = logging.getLogger(__name__)


def _user_to_out(user: User) -> UserOut:
    """Map an ORM ``User`` to the public ``UserOut`` schema."""
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        isActive=user.is_active,
        invitedAt=user.invited_at,
        lastLogin=user.last_login,
    )


@router.get("", response_model=UserListResponse)
async def list_users(
    _: Settings = Depends(require_admin),
) -> UserListResponse:
    """Return all users (active and inactive)."""
    with get_session() as session:
        users = session.scalars(select(User).order_by(User.id)).all()
    return UserListResponse(
        users=[_user_to_out(u) for u in users],
        total=len(users),
    )


@router.post(
    "/invite",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
async def invite_user(
    payload: UserInviteRequest,
    _: Settings = Depends(require_admin),
) -> UserOut:
    """Invite a new user by creating a record with the given role.

    Raises 409 if a user with the same email already exists.
    """
    with get_session() as session:
        user = User(
            email=payload.email.lower().strip(),
            name=payload.name.strip(),
            role=payload.role,
            is_active=True,
            invited_at=datetime.now(UTC),
        )
        session.add(user)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{payload.email}' already exists.",
            )
        return _user_to_out(user)


@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    payload: UserUpdateRoleRequest,
    _: Settings = Depends(require_admin),
) -> UserOut:
    """Update a user's role.  Raises 404 if the user does not exist."""
    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found.",
            )
        user.role = payload.role
        session.flush()
        return _user_to_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: int,
    _: Settings = Depends(require_admin),
) -> dict:
    """Deactivate (soft-delete) a user by setting ``is_active = False``.

    Returns a confirmation dict.  Raises 404 if the user does not exist.
    """
    with get_session() as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found.",
            )
        user.is_active = False
        session.flush()
        return {"detail": f"User {user_id} deactivated.", "userId": user_id}
