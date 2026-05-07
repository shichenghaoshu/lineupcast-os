// @lineupcast/providers — provider registry and status lookup
//
// Hardened registry with health tracking, fallback chains, and
// capability-based provider discovery.

import type { Provider, ProviderCapability } from "@lineupcast/schema";
import type { DataProvider } from "./data-provider.js";
import { MockProvider } from "./mock-provider.js";
import {
  OpenFootballProvider,
  StatsBombProvider,
  FootballDataOrgProvider,
  SportmonksProvider,
  ApiFootballProvider,
} from "./adapters.js";
import { CsvProvider } from "./csvProvider.js";
import { TheSportsProvider } from "./theSportsProvider.js";
import { SportmonksProvider as SportmonksScaffoldProvider } from "./sportmonksProvider.js";
import { ApiFootballScaffoldProvider } from "./apiFootballProvider.js";
import { FreshnessTracker, type ProviderFreshnessData } from "./freshness.js";

// ─── Health tracking ─────────────────────────────────────────────────

export type ProviderHealth = "healthy" | "degraded" | "unhealthy";

export interface ProviderHealthEntry {
  status: ProviderHealth;
  lastChecked: string; // ISO 8601
  errorCount: number;
  consecutiveErrors: number;
  lastError: string | null;
  /** Timestamp of last successful operation */
  lastSuccess: string | null;
}

/** Internal health state per provider. */
const healthState: Map<string, ProviderHealthEntry> = new Map();

function getOrCreateHealth(providerId: string): ProviderHealthEntry {
  let entry = healthState.get(providerId);
  if (!entry) {
    entry = {
      status: "healthy",
      lastChecked: new Date().toISOString(),
      errorCount: 0,
      consecutiveErrors: 0,
      lastError: null,
      lastSuccess: null,
    };
    healthState.set(providerId, entry);
  }
  return entry;
}

// ─── Provider storage ────────────────────────────────────────────────

/** All registered provider instances */
const providers: Map<string, DataProvider> = new Map();

/** Singleton tracker for per-provider sync freshness */
const freshnessTracker = new FreshnessTracker();

function register(provider: DataProvider): void {
  providers.set(provider.id, provider);
  // Initialize health entry
  getOrCreateHealth(provider.id);
}

// Register built-in providers
register(new MockProvider());
register(new OpenFootballProvider());
register(new StatsBombProvider());
register(new FootballDataOrgProvider());
register(new SportmonksProvider());
register(new ApiFootballProvider());
register(new CsvProvider());
register(new TheSportsProvider());
register(new SportmonksScaffoldProvider());
register(new ApiFootballScaffoldProvider());

// ─── Core lookups ────────────────────────────────────────────────────

/** Get a provider by id. Returns undefined if not found (never throws). */
export function getProviderByType(id: string): DataProvider | undefined {
  return providers.get(id);
}

/** Get a provider by id. Throws if not found. */
export function getProvider(id: string): DataProvider {
  const p = providers.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/** List all registered provider metadata (safe — no token values) */
export function listProviders(): Provider[] {
  return Array.from(providers.values()).map((p) => {
    const freshness = freshnessTracker.getFreshness(p.id);
    return { ...p.meta, ...freshness };
  });
}

/** List only providers that are ready to use (token present or not required, not placeholder) */
export function listReadyProviders(): Provider[] {
  return listProviders().filter((p) => isProviderReady(p));
}

/** Check whether a provider is ready (not placeholder/needs-key, token OK) */
export function isProviderReady(provider: Provider): boolean {
  const status = provider.status ?? "full";
  if (status === "placeholder" || status === "needs-key") return false;
  if (provider.requiresApiKey && !provider.tokenConfigured) return false;
  return true;
}

/**
 * List providers that are ready AND support all the given capabilities.
 * If no capabilities are requested, returns all ready providers.
 */
export function listProvidersByCapability(required: ProviderCapability[]): Provider[] {
  return listProviders().filter((p) => {
    if (!isProviderReady(p)) return false;
    const caps = p.capabilities ?? {};
    return required.every((c) => caps[c] === true);
  });
}

// ─── Registration ────────────────────────────────────────────────────

/** Register a custom provider at runtime */
export function registerProvider(provider: DataProvider): void {
  register(provider);
}

// ─── Health tracking ─────────────────────────────────────────────────

/**
 * Record a successful operation for a provider.
 * Resets consecutive error count and updates health to "healthy".
 */
export function recordProviderSuccess(providerId: string): void {
  const entry = getOrCreateHealth(providerId);
  entry.consecutiveErrors = 0;
  entry.lastSuccess = new Date().toISOString();
  entry.lastChecked = entry.lastSuccess;
  entry.status = "healthy";
  freshnessTracker.recordSync(providerId);
}

/**
 * Record a failed operation for a provider.
 * After 3 consecutive errors, status degrades to "unhealthy".
 * After 1 error, status becomes "degraded".
 */
export function recordProviderError(providerId: string, message: string): void {
  const entry = getOrCreateHealth(providerId);
  entry.errorCount += 1;
  entry.consecutiveErrors += 1;
  entry.lastError = message;
  entry.lastChecked = new Date().toISOString();

  if (entry.consecutiveErrors >= 3) {
    entry.status = "unhealthy";
  } else if (entry.consecutiveErrors >= 1) {
    entry.status = "degraded";
  }

  freshnessTracker.recordError(providerId, message);
}

/**
 * Get the health status of a specific provider.
 * Returns a snapshot of the provider's operational health.
 */
export function getProviderHealth(providerId: string): ProviderHealthEntry {
  return { ...getOrCreateHealth(providerId) };
}

/**
 * Get health status for all registered providers.
 */
export function getAllProviderHealth(): Map<string, ProviderHealthEntry> {
  const result = new Map<string, ProviderHealthEntry>();
  for (const [id] of providers) {
    result.set(id, { ...getOrCreateHealth(id) });
  }
  return result;
}

/**
 * Check if a provider is in a usable state (not "unhealthy").
 * "degraded" providers are still usable but may have issues.
 */
export function isProviderHealthy(providerId: string): boolean {
  const entry = getOrCreateHealth(providerId);
  return entry.status !== "unhealthy";
}

// ─── Fallback chain ──────────────────────────────────────────────────

/**
 * Get a provider with automatic fallback.
 *
 * Resolution order:
 *   1. Try the requested provider by id (must be registered and healthy)
 *   2. Try alternative providers that support the required capabilities
 *   3. Fall back to mock provider as last resort
 *
 * Returns the resolved provider and the id that was actually used.
 * Never throws — always resolves to at least mock.
 */
export function getProviderWithFallback(
  preferredId: string,
  requiredCapabilities?: ProviderCapability[],
): { provider: DataProvider; resolvedId: string; fallback: boolean } {
  // 1. Try the preferred provider
  const preferred = providers.get(preferredId);
  if (preferred && isProviderHealthy(preferredId) && isProviderReady(preferred.meta)) {
    // Check capabilities if required
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const caps = preferred.meta.capabilities ?? {};
      const hasAll = requiredCapabilities.every((c) => caps[c] === true);
      if (hasAll) {
        return { provider: preferred, resolvedId: preferredId, fallback: false };
      }
    } else {
      return { provider: preferred, resolvedId: preferredId, fallback: false };
    }
  }

  // 2. Try alternatives with matching capabilities
  if (requiredCapabilities && requiredCapabilities.length > 0) {
    for (const [id, candidate] of providers) {
      if (id === preferredId) continue; // already tried
      if (!isProviderHealthy(id)) continue;
      if (!isProviderReady(candidate.meta)) continue;
      const caps = candidate.meta.capabilities ?? {};
      const hasAll = requiredCapabilities.every((c) => caps[c] === true);
      if (hasAll) {
        return { provider: candidate, resolvedId: id, fallback: true };
      }
    }
  } else {
    // Try any healthy, ready provider
    for (const [id, candidate] of providers) {
      if (id === preferredId) continue;
      if (!isProviderHealthy(id)) continue;
      if (isProviderReady(candidate.meta)) {
        return { provider: candidate, resolvedId: id, fallback: true };
      }
    }
  }

  // 3. Fall back to mock
  const mock = providers.get("mock");
  if (mock) {
    return { provider: mock, resolvedId: "mock", fallback: true };
  }

  // Should never happen — mock is always registered.
  // Return the preferred even if unhealthy as absolute last resort.
  return {
    provider: preferred ?? new MockProvider(),
    resolvedId: preferred ? preferredId : "mock",
    fallback: true,
  };
}

// ─── Freshness (existing) ────────────────────────────────────────────

/** Get the singleton FreshnessTracker instance */
export function getFreshnessTracker(): FreshnessTracker {
  return freshnessTracker;
}

/** Get freshness data for a specific provider */
export function getProviderFreshness(providerId: string): ProviderFreshnessData {
  return freshnessTracker.getFreshness(providerId);
}

/** Get freshness data for all providers */
export function getAllProviderFreshness(): Map<string, ProviderFreshnessData> {
  return freshnessTracker.getAllFreshness();
}
