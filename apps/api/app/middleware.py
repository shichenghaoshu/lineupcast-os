"""Global error handling middleware and exception handlers for FastAPI.

Provides:
  - Structured error responses with ``{error, detail, requestId}`` shape.
  - A request-id injection middleware that tags every response.
  - A request logging middleware that records method, path, status, and latency.
  - Global handlers for ``HTTPException`` and unhandled exceptions that never
    leak internal stack traces to the client.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("lineupcast.middleware")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Map of common HTTP status codes to human-readable labels.
_STATUS_LABELS: dict[int, str] = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    409: "Conflict",
    413: "Payload Too Large",
    415: "Unsupported Media Type",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
}


def _error_response(
    status_code: int,
    error: str,
    detail: str,
    request_id: str,
) -> JSONResponse:
    """Build a structured JSON error response.

    Shape::

        {
            "error": "<human-readable error label>",
            "detail": "<safe detail string>",
            "requestId": "<uuid>"
        }
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "error": error,
            "detail": detail,
            "requestId": request_id,
        },
    )


def _get_request_id(request: Request) -> str:
    """Return an existing request-id or generate one."""
    return getattr(request.state, "request_id", "") or str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Middleware: request-id injection + request logging
# ---------------------------------------------------------------------------


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a unique ``X-Request-Id`` to every request and response.

    The id is stored on ``request.state.request_id`` so that downstream
    handlers and exception handlers can reference it.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status code, and latency for every request."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)

        request_id = getattr(request.state, "request_id", "-")
        logger.info(
            "%s %s -> %s (%.2fms) [rid=%s]",
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            request_id,
        )
        return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


def _register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on *app*.

    These handlers ensure that every error response follows the
    ``{error, detail, requestId}`` contract and that internal errors never
    leak implementation details to the client.
    """

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Handle explicit ``HTTPException`` raises (including from FastAPI).

        The ``detail`` field from the original exception is forwarded only for
        *client* errors (4xx).  For server errors the detail is replaced with a
        generic message.
        """
        request_id = _get_request_id(request)
        status_code = exc.status_code
        label = _STATUS_LABELS.get(status_code, "Error")

        if 400 <= status_code < 500:
            detail = str(exc.detail) if exc.detail else label
        else:
            # Never expose internal error details for 5xx.
            detail = "An internal error occurred. Please try again later."
            logger.error(
                "Unhandled HTTPException %s on %s %s: %s",
                status_code,
                request.method,
                request.url.path,
                exc.detail,
            )

        return _error_response(status_code, label, detail, request_id)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Return 422 with a safe detail string for validation errors."""
        request_id = _get_request_id(request)
        # Summarise the first few validation issues for the caller.
        errors = exc.errors()
        messages = []
        for err in errors[:5]:
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            msg = err.get("msg", "invalid value")
            messages.append(f"{loc}: {msg}")
        detail = "; ".join(messages) if messages else "Request validation failed"

        logger.warning(
            "Validation error on %s %s: %s",
            request.method,
            request.url.path,
            detail,
        )

        return _error_response(422, "Validation Error", detail, request_id)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all for any exception not handled above.

        Logs the full traceback but returns only a generic message to the
        client to avoid leaking internals.
        """
        request_id = _get_request_id(request)
        logger.exception(
            "Unhandled exception on %s %s [rid=%s]: %s",
            request.method,
            request.url.path,
            request_id,
            exc,
        )
        return _error_response(
            500,
            "Internal Server Error",
            "An internal error occurred. Please try again later.",
            request_id,
        )


# ---------------------------------------------------------------------------
# Public registration helper
# ---------------------------------------------------------------------------


def register_middleware(app: FastAPI) -> None:
    """Register all middleware and exception handlers on the given app.

    Call this from ``create_app()`` **before** including routers so that
    middleware wraps every request.

    Middleware order matters: the last-added middleware is the outermost
    wrapper.  We add logging first, then request-id, then rate limiting,
    so that the request-id is available when the logger runs and the rate
    limiter wraps the innermost handler.
    """
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestContextMiddleware)

    # Rate limiting -- imported lazily to avoid circular-import risk.
    from .rate_limiter import RateLimitMiddleware

    app.add_middleware(RateLimitMiddleware)

    _register_exception_handlers(app)
