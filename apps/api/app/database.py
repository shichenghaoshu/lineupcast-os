"""SQLAlchemy engine and session setup for PostgreSQL persistence.

Supports both PostgreSQL (production) and SQLite (development) via the
``LINEUPCAST_DATABASE_URL`` environment variable.  Defaults to SQLite
for zero-config local development.

Usage::

    from .database import get_session

    with get_session() as session:
        session.execute(...)
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def _build_engine(url: str):
    """Create an engine with sensible defaults for the given URL scheme."""
    connect_args: dict = {}
    kwargs: dict = {}

    if url.startswith("sqlite"):
        # SQLite-specific pragmas for concurrent WAL reads.
        connect_args["check_same_thread"] = False
        kwargs["connect_args"] = connect_args

    engine = create_engine(url, pool_pre_ping=True, **kwargs)

    if url.startswith("sqlite"):
        # Attach pragma listener to the *created* engine so it fires on
        # every new DBAPI connection.
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _connection_record):  # type: ignore[no-untyped-def]
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def get_engine():
    """Return the singleton engine, creating it on first call."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = _build_engine(settings.database_url)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the session factory bound to the singleton engine."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
        )
    return _SessionLocal


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Yield a scoped database session with automatic commit/rollback.

    Usage::

        with get_session() as session:
            row = session.query(Match).first()
    """
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Create all tables defined in ``models.Base`` (idempotent).

    Call once at application startup or via an Alembic migration runner.
    """
    from . import models  # noqa: F811 -- deferred to avoid circular imports

    engine = get_engine()
    models.Base.metadata.create_all(bind=engine)


def reset_engine() -> None:
    """Dispose of the engine and session factory (useful for testing)."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None
