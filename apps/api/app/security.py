"""Authentication dependencies for the API."""

from secrets import compare_digest

from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings


async def require_admin(
    settings: Settings = Depends(get_settings),
    authorization: str | None = Header(None),
) -> Settings:
    """Require a valid admin bearer token when LINEUPCAST_ADMIN_TOKEN is set.

    Returns the Settings object so endpoints that already depended on
    ``get_settings`` can swap in this dependency transparently.
    """
    if not settings.admin_token:
        return settings
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = authorization[7:]
    if not compare_digest(token, settings.admin_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return settings
