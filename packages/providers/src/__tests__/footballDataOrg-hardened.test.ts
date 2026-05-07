import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FootballDataOrgProvider } from "../footballDataOrgProvider.js";
import { RateLimiter, FOOTBALL_DATA_ORG_LIMITER } from "../rate-limiter.js";

// ─── Fixtures ──────────────────────────────────────────────────────────

const MATCH_LIST_RESPONSE = {
  matches: [
    {
      id: 12345,
      competition: { id: 2021, name: "Premier League", code: "PL" },
      utcDate: "2026-05-10T15:00:00Z",
      status: "SCHEDULED",
      matchday: 37,
      homeTeam: {
        id: 57,
        name: "Arsenal",
        shortName: "Arsenal",
        tla: "ARS",
        crest: "https://crests.football-data.org/57.png",
        score: null,
      },
      awayTeam: {
        id: 65,
        name: "Manchester City",
        shortName: "Man City",
        tla: "MCI",
        crest: "https://crests.football-data.org/65.png",
        score: null,
      },
    },
  ],
};

const VALID_TEAM_RESPONSE = {
  id: 57,
  name: "Arsenal",
  shortName: "Arsenal",
  tla: "ARS",
  crest: "https://crests.football-data.org/57.png",
  founded: 1886,
  venue: "Emirates Stadium",
  squad: [
    {
      id: 3269,
      name: "Bukayo Saka",
      position: "Right Winger",
      dateOfBirth: "2001-09-05",
      nationality: "England",
      shirtNumber: 7,
      role: "PLAYER",
    },
  ],
};

const STANDINGS_RESPONSE = {
  standings: [
    {
      type: "TOTAL",
      table: [
        {
          position: 1,
          team: { id: 57, name: "Arsenal", crest: "" },
          playedGames: 36,
          won: 28,
          draw: 5,
          lost: 3,
          points: 89,
          goalsFor: 85,
          goalsAgainst: 28,
          goalDifference: 57,
          form: "WWWDW",
        },
      ],
    },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────

function mockFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(data),
  });
}

function mockFetchStatus(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ message: statusText }),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError("fetch failed"));
}

function mockFetchTimeout() {
  return vi.fn().mockRejectedValue(
    Object.assign(new DOMException("The operation was aborted.", "AbortError"), {
      name: "AbortError",
    }),
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("FootballDataOrgProvider — Hardened", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    FOOTBALL_DATA_ORG_LIMITER.reset();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  // ── Missing token detection ─────────────────────────────────────────

  describe("missing token detection", () => {
    it("returns missing_token status when API key is empty", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      expect(provider.getHealth().status).toBe("missing_token");
    });

    it("returns missing_token status when API key is not set in env", () => {
      delete process.env["FOOTBALL_DATA_API_KEY"];
      const provider = new FootballDataOrgProvider();
      expect(provider.getHealth().status).toBe("missing_token");
    });

    it("all data methods return empty/default when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });

      const fixtures = await provider.getFixtures("premier-league");
      expect(fixtures).toEqual([]);

      const match = await provider.getMatch("fdm-12345");
      expect(match).toBeNull();

      const recent = await provider.getRecentMatches("fdm-team-57");
      expect(recent).toEqual([]);

      const squad = await provider.getSquad("fdm-team-57");
      expect(squad).toEqual([]);

      const standings = await provider.getStandings("premier-league");
      expect(standings).toEqual([]);
    });

    it("fetchMatch returns placeholder when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.fetchMatch("fdm-12345");
      expect(result).toBeDefined();
      expect(result.id).toBe("fdm-12345");
      expect(result.homeTeam.name).toBe("Unknown");
    });

    it("fetchTeam returns placeholder when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.fetchTeam("fdm-team-57");
      expect(result).toBeDefined();
      expect(result.id).toBe("fdm-team-57");
      expect(result.name).toBe("Unknown");
    });

    it("never makes network calls when token is missing", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const provider = new FootballDataOrgProvider({ apiKey: "" });
      await provider.getFixtures("premier-league");
      await provider.getMatch("fdm-12345");
      await provider.getRecentMatches("fdm-team-57");
      await provider.getSquad("fdm-team-57");
      await provider.getStandings("premier-league");

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("health message includes FOOTBALL_DATA_API_KEY reference", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const health = provider.getHealth();
      expect(health.message).toContain("FOOTBALL_DATA_API_KEY");
    });
  });

  // ── Rate limit handling ────────────────────────────────────────────

  describe("rate limit handling (429)", () => {
    it("returns rate_limited status on HTTP 429", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(429, "Too Many Requests"));

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("rate_limited");
    });

    it("returns empty data on HTTP 429", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(429, "Too Many Requests"));

      const fixtures = await provider.getFixtures("premier-league");
      expect(fixtures).toEqual([]);
    });

    it("returns rate_limited when local rate limiter is exhausted", async () => {
      const exhaustedLimiter = new RateLimiter(0, 0, 60_000);
      const provider = new FootballDataOrgProvider(
        { apiKey: "key" },
        exhaustedLimiter,
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("premier-league");

      expect(provider.getHealth().status).toBe("rate_limited");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rate_limited status includes descriptive message", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(429, "Too Many Requests"));

      await provider.getFixtures("premier-league");
      const health = provider.getHealth();
      expect(health.status).toBe("rate_limited");
      expect(health.message).toBeDefined();
    });

    it("recovers from rate_limited to healthy after successful call", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve(MATCH_LIST_RESPONSE),
        });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("rate_limited");

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("healthy");
    });
  });

  // ── Degraded mode for partial data ─────────────────────────────────

  describe("degraded mode", () => {
    it("returns degraded status on HTTP 5xx", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns degraded status on HTTP 503", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(503, "Service Unavailable"));

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns empty data in degraded mode", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(502, "Bad Gateway"));

      const fixtures = await provider.getFixtures("premier-league");
      expect(fixtures).toEqual([]);
    });

    it("returns degraded on schema mismatch (response lacks expected fields)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      // Return an object that doesn't match FDOMatchResponse shape.
      vi.stubGlobal("fetch", mockFetchSuccess({ unexpected: "data" }));

      const fixtures = await provider.getFixtures("premier-league");
      expect(fixtures).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns degraded on match schema mismatch", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      // Return object missing required match fields.
      vi.stubGlobal("fetch", mockFetchSuccess({ wrong: "shape" }));

      const match = await provider.getMatch("fdm-12345");
      expect(match).toBeNull();
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns degraded on team schema mismatch", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ wrong: "shape" }));

      const result = await provider.fetchTeam("fdm-team-57");
      expect(result).toBeDefined();
      expect(result.name).toBe("Unknown");
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns degraded on standings schema mismatch", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ wrong: "shape" }));

      const standings = await provider.getStandings("premier-league");
      expect(standings).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("recovers from degraded to healthy after successful call", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve(MATCH_LIST_RESPONSE),
        });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("degraded");

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("healthy");
    });
  });

  // ── Offline mode ──────────────────────────────────────────────────

  describe("offline mode", () => {
    it("returns offline status on network error (TypeError)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("offline");
    });

    it("returns offline status on timeout (AbortError)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchTimeout());

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("offline");
    });

    it("returns empty data when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const fixtures = await provider.getFixtures("premier-league");
      expect(fixtures).toEqual([]);
    });

    it("offline message mentions network connectivity", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      // Manually set status to test the message.
      // The status gets set by apiFetch, so we trigger it first.
      vi.stubGlobal("fetch", mockFetchNetworkError());

      return provider.getFixtures("premier-league").then(() => {
        const health = provider.getHealth();
        expect(health.status).toBe("offline");
        expect(health.message).toBeDefined();
      });
    });

    it("fetchMatch returns placeholder when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchMatch("fdm-12345");
      expect(result).toBeDefined();
      expect(result.id).toBe("fdm-12345");
      expect(result.homeTeam.name).toBe("Unknown");
    });

    it("fetchTeam returns placeholder when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchTeam("fdm-team-57");
      expect(result).toBeDefined();
      expect(result.id).toBe("fdm-team-57");
      expect(result.name).toBe("Unknown");
    });

    it("fetchSquad returns empty when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchSquad("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("fetchForm returns empty when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchForm("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("fetchH2H returns empty record when offline", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchH2H("fdm-team-57", "fdm-team-65");
      expect(result.totalMatches).toBe(0);
      expect(result.lastMeetings).toEqual([]);
    });

    it("recovers from offline to healthy after successful call", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = vi.fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve(MATCH_LIST_RESPONSE),
        });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("offline");

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("healthy");
    });
  });

  // ── Schema mismatch handling ──────────────────────────────────────

  describe("schema mismatch handling", () => {
    it("getFixtures handles response without matches array", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ data: "unexpected" }));

      const result = await provider.getFixtures("premier-league");
      expect(result).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("getMatch handles response without required fields", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ foo: "bar" }));

      const result = await provider.getMatch("fdm-12345");
      expect(result).toBeNull();
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("getSquad handles response without id/name", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ foo: "bar" }));

      const result = await provider.getSquad("fdm-team-57");
      expect(result).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("getStandings handles response without standings array", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess({ foo: "bar" }));

      const result = await provider.getStandings("premier-league");
      expect(result).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("handles null response gracefully", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(null),
        }),
      );

      const result = await provider.getFixtures("premier-league");
      expect(result).toEqual([]);
    });
  });

  // ── Health check method ───────────────────────────────────────────

  describe("runHealthCheck", () => {
    it("returns missing_token when API key is not set", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.runHealthCheck();

      expect(result.status).toBe("missing_token");
      expect(result.tokenValid).toBe(false);
      expect(result.rateLimited).toBe(false);
      expect(result.latencyMs).toBe(0);
      expect(result.timestamp).toBeDefined();
      expect(result.message).toContain("FOOTBALL_DATA_API_KEY");
    });

    it("returns rate_limited when local rate limiter is exhausted", async () => {
      const exhaustedLimiter = new RateLimiter(0, 0, 60_000);
      const provider = new FootballDataOrgProvider(
        { apiKey: "key" },
        exhaustedLimiter,
      );

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("rate_limited");
      expect(result.tokenValid).toBe(true);
      expect(result.rateLimited).toBe(true);
      expect(result.message).toContain("rate limit");
    });

    it("returns healthy on successful API call", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(MATCH_LIST_RESPONSE));

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("healthy");
      expect(result.tokenValid).toBe(true);
      expect(result.rateLimited).toBe(false);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it("returns missing_token on HTTP 401", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "bad-key" });
      vi.stubGlobal("fetch", mockFetchStatus(401, "Unauthorized"));

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("missing_token");
      expect(result.tokenValid).toBe(false);
      expect(result.message).toContain("invalid");
    });

    it("returns missing_token on HTTP 403", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "bad-key" });
      vi.stubGlobal("fetch", mockFetchStatus(403, "Forbidden"));

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("missing_token");
      expect(result.tokenValid).toBe(false);
    });

    it("returns rate_limited on HTTP 429", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(429, "Too Many Requests"));

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("rate_limited");
      expect(result.tokenValid).toBe(true);
      expect(result.rateLimited).toBe(true);
    });

    it("returns degraded on HTTP 500", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("degraded");
      expect(result.tokenValid).toBe(true);
    });

    it("returns offline on network error", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.runHealthCheck();
      expect(result.status).toBe("offline");
      expect(result.tokenValid).toBe(true);
      expect(result.message).toContain("unreachable");
    });

    it("includes latency measurement on success", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(MATCH_LIST_RESPONSE));

      const result = await provider.runHealthCheck();
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("includes latency measurement on failure", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.runHealthCheck();
      expect(typeof result.latencyMs).toBe("number");
    });

    it("includes ISO timestamp", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(MATCH_LIST_RESPONSE));

      const result = await provider.runHealthCheck();
      // Verify it's a valid ISO date string.
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("never exposes API key in responses", async () => {
      const secretKey = "super-secret-api-key-12345";
      const provider = new FootballDataOrgProvider({ apiKey: secretKey });
      vi.stubGlobal("fetch", mockFetchSuccess(MATCH_LIST_RESPONSE));

      const result = await provider.runHealthCheck();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(secretKey);
    });
  });

  // ── API key never exposed ─────────────────────────────────────────

  describe("API key security", () => {
    it("getHealth never exposes the API key", () => {
      const secretKey = "super-secret-key-999";
      const provider = new FootballDataOrgProvider({ apiKey: secretKey });
      const health = provider.getHealth();
      const serialized = JSON.stringify(health);
      expect(serialized).not.toContain(secretKey);
    });

    it("meta never exposes the API key", () => {
      const secretKey = "super-secret-key-999";
      const provider = new FootballDataOrgProvider({ apiKey: secretKey });
      const serialized = JSON.stringify(provider.meta);
      expect(serialized).not.toContain(secretKey);
    });

    it("tokenConfigured is true but token value is not stored in meta", () => {
      const secretKey = "super-secret-key-999";
      const provider = new FootballDataOrgProvider({ apiKey: secretKey });
      expect(provider.meta.tokenConfigured).toBe(true);
      // There should be no apiKey field in meta.
      expect((provider.meta as Record<string, unknown>)["apiKey"]).toBeUndefined();
    });
  });

  // ── Capability detection ──────────────────────────────────────────

  describe("capability detection", () => {
    it("fixtures are always available with token", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.upcomingMatches).toBe(true);
    });

    it("match detail is available", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.match).toBe(true);
    });

    it("recent matches are available (via team matches)", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.team).toBe(true);
    });

    it("standings are available", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.standings).toBe(true);
    });

    it("H2H is derived from recent matches", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.h2h).toBe(true);
    });

    it("lineups are available (may be empty pre-match)", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.capabilities?.lineup).toBe(true);
    });

    it("requires API key", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.requiresApiKey).toBe(true);
    });

    it("status is needs-key when API key is missing", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      expect(provider.meta.status).toBe("needs-key");
    });

    it("status is full when API key is present", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.status).toBe("full");
    });
  });

  // ── Graceful fallback (never crash) ───────────────────────────────

  describe("graceful fallback — never crash", () => {
    it("fetchUpcomingMatches never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchUpcomingMatches("premier-league")).resolves.toEqual([]);
    });

    it("fetchMatch never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchMatch("fdm-12345")).resolves.toBeDefined();
    });

    it("fetchTeam never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchTeam("fdm-team-57")).resolves.toBeDefined();
    });

    it("fetchSquad never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchSquad("fdm-team-57")).resolves.toEqual([]);
    });

    it("fetchLineup never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      await expect(provider.fetchLineup("fdm-12345", "fdm-team-57")).resolves.toBeDefined();
    });

    it("fetchMatchStats never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      await expect(provider.fetchMatchStats("fdm-12345")).resolves.toBeDefined();
    });

    it("fetchH2H never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchH2H("fdm-team-57", "fdm-team-65")).resolves.toBeDefined();
    });

    it("fetchForm never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.fetchForm("fdm-team-57")).resolves.toEqual([]);
    });

    it("fetchPrediction never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      await expect(provider.fetchPrediction("fdm-12345")).resolves.toBeDefined();
    });

    it("runHealthCheck never throws", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());
      await expect(provider.runHealthCheck()).resolves.toBeDefined();
    });
  });
});
