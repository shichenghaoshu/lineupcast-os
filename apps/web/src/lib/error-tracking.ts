/**
 * Client-side error tracking.
 *
 * Captures global errors, unhandled promise rejections, and manual
 * error reports, storing them in localStorage for later retrieval.
 */

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  url: string;
  userAgent: string;
  /** Extra context supplied by application code. */
  context?: Record<string, unknown>;
}

const STORAGE_KEY = "lineupcast_error_log";
const MAX_ERRORS = 50;

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

function loadErrors(): TrackedError[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackedError[]) : [];
  } catch {
    return [];
  }
}

function persistErrors(errors: TrackedError[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(-MAX_ERRORS)));
  } catch {
    // localStorage may be full or unavailable -- silently ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Core reporting                                                     */
/* ------------------------------------------------------------------ */

let initialized = false;

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Record an error into the local log.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const message =
    error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const entry: TrackedError = {
    id: makeId(),
    message,
    stack,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    context,
  };

  const errors = loadErrors();
  errors.push(entry);
  persistErrors(errors);

  // Also surface in dev console for convenience
  if (process.env.NODE_ENV !== "production") {
    console.error("[LineupCast ErrorTracking]", message, context ?? "", stack ?? "");
  }
}

/* ------------------------------------------------------------------ */
/*  Global handlers                                                    */
/* ------------------------------------------------------------------ */

function handleGlobalError(event: ErrorEvent): void {
  event.preventDefault();
  reportError(event.message, {
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: "global-error",
  });
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  event.preventDefault();
  reportError(event.reason, {
    type: "unhandled-rejection",
  });
}

/**
 * Attach global error listeners. Safe to call multiple times (idempotent).
 */
export function initErrorTracking(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("error", handleGlobalError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
}

/* ------------------------------------------------------------------ */
/*  Log accessors                                                      */
/* ------------------------------------------------------------------ */

/** Return a copy of the stored error log. */
export function getErrorLog(): TrackedError[] {
  return loadErrors();
}

/** Clear all stored errors. */
export function clearErrorLog(): void {
  persistErrors([]);
}
