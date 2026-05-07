import { describe, it, expect, beforeEach } from "vitest";
import {
  getProvider,
  getProviderByType,
  listProviders,
  listReadyProviders,
  listProvidersByCapability,
  isProviderReady,
  registerProvider,
  // Health tracking
  recordProviderSuccess,
  recordProviderError,
  getProviderHealth,
  getAllProviderHealth,
  isProviderHealthy,
  // Fallback chain
  getProviderWithFallback,
} from "../registry.js";
import { MockProvider } from "../mock-provider.js";
import type { DataProvider } from "../data-provider.js";
import type { Provider } from "@lineupcast/schema";

// ─── Helper: create a minimal test provider ──────────────────────────

function createTestProvider(
  id: string,
  overrides?: Partial<Provider>,
): DataProvider {
  const meta: Provider = {
    id,
    name: `Test ${id}`,
    description: `Test provider ${id}`,
    requiresApiKey: false,
    tokenConfigured: false,
    status: "full",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
    },
    ...overrides,
  };

  return {
    id,
    meta,
    async fetchUpcomingMatches() { return []; },
    async fetchMatch(matchId: string) {
      return {
        id: matchId,
        homeTeamId: "",
        awayTeamId: "",
        kickoff: "",
        league: "",
        status: "scheduled",
      };
    },
    async fetchTeam(teamId: string) {
      return { id: teamId, name: teamId, shortName: teamId.substring(0, 3).toUpperCase(), league: "" };
    },
    async fetchSquad() { return []; },
    async fetchLineup(matchId: string, teamId: string) {
      return { matchId, teamId, formation: "", starters: [], substitutes: [] };
    },
    async fetchMatchStats(matchId: string) {
      return {
        matchId,
        homeXG: 0,
        awayXG: 0,
        homePossession: 0,
        awayPossession: 0,
        homeShots: 0,
        awayShots: 0,
      };
    },
    async fetchH2H(teamAId: string, teamBId: string) {
      return {
        teamAId,
        teamBId,
        totalMatches: 0,
        teamAWins: 0,
        draws: 0,
        teamBWins: 0,
        lastMeetings: [],
      };
    },
    async fetchForm() { return []; },
    async fetchPrediction(matchId: string) {
      return {
        matchId,
        homeWin: 0,
        draw: 0,
        awayWin: 0,
        expectedHomeGoals: 0,
        expectedAwayGoals: 0,
        confidence: "low",
      };
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("hardened registry", () => {
  describe("getProviderByType", () => {
    it("returns provider when found", () => {
      const p = getProviderByType("mock");
      expect(p).toBeDefined();
      expect(p!.id).toBe("mock");
    });

    it("returns undefined for unknown provider (never throws)", () => {
      const p = getProviderByType("nonexistent");
      expect(p).toBeUndefined();
    });
  });

  describe("fallback chain", () => {
    it("returns the preferred provider when healthy and ready", () => {
      const result = getProviderWithFallback("mock");
      expect(result.resolvedId).toBe("mock");
      expect(result.fallback).toBe(false);
      expect(result.provider.id).toBe("mock");
    });

    it("falls back to mock for unknown provider", () => {
      const result = getProviderWithFallback("nonexistent");
      expect(result.resolvedId).toBe("mock");
      expect(result.fallback).toBe(true);
      expect(result.provider.id).toBe("mock");
    });

    it("falls back when preferred provider is unhealthy", () => {
      // Register a test provider, then mark it unhealthy
      const testProvider = createTestProvider("test-unhealthy-fallback");
      registerProvider(testProvider);

      // Mark as unhealthy (3+ consecutive errors)
      recordProviderError("test-unhealthy-fallback", "error 1");
      recordProviderError("test-unhealthy-fallback", "error 2");
      recordProviderError("test-unhealthy-fallback", "error 3");

      const result = getProviderWithFallback("test-unhealthy-fallback");
      expect(result.resolvedId).not.toBe("test-unhealthy-fallback");
      expect(result.fallback).toBe(true);
    });

    it("falls back when preferred provider lacks required capabilities", () => {
      // Register a provider with limited capabilities
      const limitedProvider = createTestProvider("test-limited-caps", {
        capabilities: { upcomingMatches: true },
      });
      registerProvider(limitedProvider);

      const result = getProviderWithFallback("test-limited-caps", [
        "upcomingMatches",
        "lineup",
        "prediction",
      ]);
      // Should fall back to something with all capabilities
      expect(result.fallback).toBe(true);
      const resolved = getProvider(result.resolvedId);
      const caps = resolved.meta.capabilities ?? {};
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.lineup).toBe(true);
      expect(caps.prediction).toBe(true);
    });

    it("prefers healthy providers with matching capabilities as alternatives", () => {
      // Mock has all capabilities and is healthy
      const result = getProviderWithFallback("nonexistent", [
        "upcomingMatches",
        "prediction",
      ]);
      expect(result.fallback).toBe(true);
      expect(result.resolvedId).toBe("mock");
    });

    it("always resolves to at least mock (never returns null)", () => {
      const result = getProviderWithFallback("completely-fake-id");
      expect(result.provider).toBeDefined();
      expect(result.provider.id).toBeDefined();
    });
  });

  describe("health tracking", () => {
    it("new providers start as healthy", () => {
      const health = getProviderHealth("mock");
      expect(health.status).toBe("healthy");
      expect(health.errorCount).toBe(0);
      expect(health.consecutiveErrors).toBe(0);
      expect(health.lastError).toBeNull();
    });

    it("single error makes provider degraded", () => {
      // Use a unique id to avoid cross-test pollution
      const id = "test-degraded-single";
      registerProvider(createTestProvider(id));

      recordProviderError(id, "some error");

      const health = getProviderHealth(id);
      expect(health.status).toBe("degraded");
      expect(health.errorCount).toBe(1);
      expect(health.consecutiveErrors).toBe(1);
      expect(health.lastError).toBe("some error");
    });

    it("three consecutive errors make provider unhealthy", () => {
      const id = "test-unhealthy-3";
      registerProvider(createTestProvider(id));

      recordProviderError(id, "err 1");
      recordProviderError(id, "err 2");
      recordProviderError(id, "err 3");

      const health = getProviderHealth(id);
      expect(health.status).toBe("unhealthy");
      expect(health.errorCount).toBe(3);
      expect(health.consecutiveErrors).toBe(3);
    });

    it("success resets consecutive errors and restores health", () => {
      const id = "test-heal";
      registerProvider(createTestProvider(id));

      recordProviderError(id, "err 1");
      recordProviderError(id, "err 2");
      expect(getProviderHealth(id).status).toBe("degraded");

      recordProviderSuccess(id);
      const health = getProviderHealth(id);
      expect(health.status).toBe("healthy");
      expect(health.consecutiveErrors).toBe(0);
      expect(health.lastSuccess).toBeDefined();
    });

    it("success after unhealthy restores to healthy", () => {
      const id = "test-heal-unhealthy";
      registerProvider(createTestProvider(id));

      recordProviderError(id, "err 1");
      recordProviderError(id, "err 2");
      recordProviderError(id, "err 3");
      expect(getProviderHealth(id).status).toBe("unhealthy");

      recordProviderSuccess(id);
      expect(getProviderHealth(id).status).toBe("healthy");
    });

    it("error count accumulates across resets", () => {
      const id = "test-accumulate";
      registerProvider(createTestProvider(id));

      recordProviderError(id, "err 1");
      recordProviderSuccess(id);
      recordProviderError(id, "err 2");

      const health = getProviderHealth(id);
      expect(health.errorCount).toBe(2); // total errors
      expect(health.consecutiveErrors).toBe(1); // since last success
      expect(health.status).toBe("degraded");
    });

    it("isProviderHealthy returns true for healthy providers", () => {
      const id = "test-is-healthy";
      registerProvider(createTestProvider(id));
      expect(isProviderHealthy(id)).toBe(true);
    });

    it("isProviderHealthy returns true for degraded providers", () => {
      const id = "test-is-degraded";
      registerProvider(createTestProvider(id));
      recordProviderError(id, "err");
      expect(isProviderHealthy(id)).toBe(true); // degraded is still usable
    });

    it("isProviderHealthy returns false for unhealthy providers", () => {
      const id = "test-is-unhealthy";
      registerProvider(createTestProvider(id));
      recordProviderError(id, "err 1");
      recordProviderError(id, "err 2");
      recordProviderError(id, "err 3");
      expect(isProviderHealthy(id)).toBe(false);
    });

    it("isProviderHealthy returns true for unknown providers (defaults to healthy)", () => {
      // Unknown provider gets auto-created as healthy
      expect(isProviderHealthy("unknown-provider-xyz")).toBe(true);
    });

    it("getAllProviderHealth returns health for all providers", () => {
      const all = getAllProviderHealth();
      expect(all.has("mock")).toBe(true);
      expect(all.get("mock")!.status).toBe("healthy");
    });

    it("getProviderHealth returns a copy (not a reference)", () => {
      const h1 = getProviderHealth("mock");
      const h2 = getProviderHealth("mock");
      expect(h1).not.toBe(h2); // different object references
      expect(h1).toEqual(h2); // same values
    });
  });

  describe("capability query", () => {
    it("listProvidersByCapability filters by required capabilities", () => {
      const result = listProvidersByCapability(["prediction"]);
      const ids = result.map((p) => p.id);
      expect(ids).toContain("mock");
      // Other providers that lack prediction should not appear
    });

    it("listProvidersByCapability with multiple requirements", () => {
      const result = listProvidersByCapability([
        "upcomingMatches",
        "match",
        "team",
        "squad",
        "lineup",
        "prediction",
      ]);
      const ids = result.map((p) => p.id);
      // Mock has all of these
      expect(ids).toContain("mock");
    });

    it("listProvidersByCapability returns all ready when empty array", () => {
      const ready = listReadyProviders();
      const all = listProvidersByCapability([]);
      expect(all.length).toBeGreaterThanOrEqual(ready.length);
    });

    it("csv provider appears for matching capabilities", () => {
      const result = listProvidersByCapability(["lineup", "form"]);
      const ids = result.map((p) => p.id);
      expect(ids).toContain("csv");
    });
  });

  describe("built-in providers registered", () => {
    it("CsvProvider is registered", () => {
      const p = getProviderByType("csv");
      expect(p).toBeDefined();
      expect(p!.meta.name).toBe("CSV Data Provider");
    });

    it("TheSportsProvider is registered", () => {
      const p = getProviderByType("thesports");
      expect(p).toBeDefined();
      expect(p!.meta.name).toBe("TheSports API");
    });

    it("all original providers are still registered", () => {
      expect(getProviderByType("mock")).toBeDefined();
      expect(getProviderByType("openfootball")).toBeDefined();
      expect(getProviderByType("statsbomb")).toBeDefined();
      expect(getProviderByType("football-data-org")).toBeDefined();
      expect(getProviderByType("sportmonks")).toBeDefined();
      expect(getProviderByType("api-football")).toBeDefined();
    });
  });
});
