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
    {
      id: 12346,
      competition: { id: 2021, name: "Premier League", code: "PL" },
      utcDate: "2026-05-03T17:30:00Z",
      status: "FINISHED",
      matchday: 36,
      homeTeam: {
        id: 65,
        name: "Manchester City",
        shortName: "Man City",
        tla: "MCI",
        crest: "https://crests.football-data.org/65.png",
        score: 2,
      },
      awayTeam: {
        id: 57,
        name: "Arsenal",
        shortName: "Arsenal",
        tla: "ARS",
        crest: "https://crests.football-data.org/57.png",
        score: 1,
      },
    },
  ],
};

const SINGLE_MATCH_RESPONSE = {
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
  referees: [{ name: "Michael Oliver", type: "REFEREE" }],
};

const TEAM_RESPONSE = {
  id: 57,
  name: "Arsenal",
  shortName: "Arsenal",
  tla: "ARS",
  crest: "https://crests.football-data.org/57.png",
  founded: 1886,
  venue: "Emirates Stadium",
  runningCompetitions: [{ id: 2021, name: "Premier League", code: "PL" }],
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
    {
      id: 3270,
      name: "Martin Odegaard",
      position: "Central Midfield",
      dateOfBirth: "1998-12-17",
      nationality: "Norway",
      shirtNumber: 8,
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
          team: { id: 57, name: "Arsenal", crest: "https://crests.football-data.org/57.png" },
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
        {
          position: 2,
          team: { id: 65, name: "Manchester City", crest: "https://crests.football-data.org/65.png" },
          playedGames: 36,
          won: 26,
          draw: 6,
          lost: 4,
          points: 84,
          goalsFor: 80,
          goalsAgainst: 30,
          goalDifference: 50,
          form: "WDWLW",
        },
      ],
    },
  ],
};

const RECENT_MATCHES_RESPONSE = {
  matches: [
    {
      id: 11111,
      competition: { id: 2021, name: "Premier League", code: "PL" },
      utcDate: "2026-05-03T15:00:00Z",
      status: "FINISHED",
      matchday: 36,
      homeTeam: { id: 57, name: "Arsenal", shortName: "Arsenal", tla: "ARS", crest: "", score: 3 },
      awayTeam: { id: 73, name: "Tottenham", shortName: "Spurs", tla: "TOT", crest: "", score: 1 },
    },
    {
      id: 11112,
      competition: { id: 2021, name: "Premier League", code: "PL" },
      utcDate: "2026-04-26T15:00:00Z",
      status: "FINISHED",
      matchday: 35,
      homeTeam: { id: 66, name: "Aston Villa", shortName: "Villa", tla: "AVL", crest: "", score: 0 },
      awayTeam: { id: 57, name: "Arsenal", shortName: "Arsenal", tla: "ARS", crest: "", score: 2 },
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

// ─── Tests ─────────────────────────────────────────────────────────────

describe("FootballDataOrgProvider (standalone)", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    FOOTBALL_DATA_ORG_LIMITER.reset();
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  // ── Configuration ─────────────────────────────────────────────────

  describe("configuration", () => {
    it("reads apiKey from constructor config", () => {
      const provider = new FootballDataOrgProvider({
        apiKey: "test-key-123",
        baseUrl: "https://api.football-data.org/v4",
      });
      expect(provider.meta.tokenConfigured).toBe(true);
    });

    it("reads apiKey from FOOTBALL_DATA_API_KEY env var when no constructor config", () => {
      process.env["FOOTBALL_DATA_API_KEY"] = "env-key";
      const provider = new FootballDataOrgProvider();
      expect(provider.meta.tokenConfigured).toBe(true);
    });

    it("defaults baseUrl to v4 when not provided", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "x" });
      expect(provider.meta.baseUrl).toBe("https://api.football-data.org/v4");
    });

    it("uses custom baseUrl from FOOTBALL_DATA_BASE_URL env var", () => {
      process.env["FOOTBALL_DATA_BASE_URL"] = "https://custom.api/v4";
      process.env["FOOTBALL_DATA_API_KEY"] = "key";
      const provider = new FootballDataOrgProvider();
      expect(provider.meta.baseUrl).toBe("https://custom.api/v4");
    });
  });

  // ── Health / status ──────────────────────────────────────────────

  describe("health status", () => {
    it("returns missing_token when apiKey is empty", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      expect(provider.getHealth().status).toBe("missing_token");
    });

    it("returns healthy when apiKey is provided", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "some-key" });
      expect(provider.getHealth().status).toBe("healthy");
    });

    it("meta.status is needs-key when apiKey is empty", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      expect(provider.meta.status).toBe("needs-key");
    });

    it("meta.status is full when apiKey is provided", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "some-key" });
      expect(provider.meta.status).toBe("full");
    });

    it("returns rate_limited on HTTP 429", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(429, "Too Many Requests"));

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("rate_limited");
    });

    it("returns degraded on HTTP 5xx", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("returns degraded on network error", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("recovers to healthy after a successful call following a failure", async () => {
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

  // ── Missing token behavior ──────────────────────────────────────

  describe("missing token", () => {
    it("getFixtures returns empty array when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.getFixtures("premier-league");
      expect(result).toEqual([]);
    });

    it("getMatch returns null when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.getMatch("fdm-12345");
      expect(result).toBeNull();
    });

    it("getRecentMatches returns empty array when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.getRecentMatches("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("getSquad returns empty array when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.getSquad("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("getStandings returns empty array when token is missing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      const result = await provider.getStandings("premier-league");
      expect(result).toEqual([]);
    });

    it("health status is missing_token after any call without key", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "" });
      await provider.getFixtures("premier-league");
      expect(provider.getHealth().status).toBe("missing_token");
      expect(provider.getHealth().message).toContain("FOOTBALL_DATA_API_KEY");
    });

    it("does not make any fetch call when token is missing", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const provider = new FootballDataOrgProvider({ apiKey: "" });
      await provider.getFixtures("premier-league");

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── getFixtures ──────────────────────────────────────────────────

  describe("getFixtures", () => {
    it("maps league slug to competition code and fetches matches", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess(MATCH_LIST_RESPONSE);
      vi.stubGlobal("fetch", fetchSpy);

      const matches = await provider.getFixtures("premier-league");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/competitions/PL/matches"),
        expect.objectContaining({ headers: { "X-Auth-Token": "key" } }),
      );
      expect(matches).toHaveLength(2);
    });

    it("maps unknown league slug to uppercase code", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess({ matches: [] });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("eredivisie");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/competitions/EREDIVISIE/matches"),
        expect.anything(),
      );
    });

    it("appends status query parameter when provided", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess({ matches: [] });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getFixtures("premier-league", "FINISHED");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("status=FINISHED"),
        expect.anything(),
      );
    });

    it("returns empty array on API failure (never throws)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      const result = await provider.getFixtures("premier-league");
      expect(result).toEqual([]);
    });
  });

  // ── getMatch ─────────────────────────────────────────────────────

  describe("getMatch", () => {
    it("fetches a match by raw numeric ID", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(SINGLE_MATCH_RESPONSE));

      const match = await provider.getMatch("12345");

      expect(match).not.toBeNull();
      expect(match!.id).toBe("fdm-12345");
      expect(match!.homeTeam!.name).toBe("Arsenal");
      expect(match!.awayTeam!.name).toBe("Manchester City");
      expect(match!.status).toBe("scheduled");
      expect(match!.matchday).toBe(37);
    });

    it("strips fdm- prefix from match ID", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess(SINGLE_MATCH_RESPONSE);
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getMatch("fdm-12345");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/matches/12345"),
        expect.anything(),
      );
    });

    it("returns null when API returns non-OK", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(404, "Not Found"));

      const result = await provider.getMatch("99999");
      expect(result).toBeNull();
    });
  });

  // ── getRecentMatches ─────────────────────────────────────────────

  describe("getRecentMatches", () => {
    it("fetches finished matches for a team with default limit 5", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess(RECENT_MATCHES_RESPONSE);
      vi.stubGlobal("fetch", fetchSpy);

      const matches = await provider.getRecentMatches("fdm-team-57");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/teams/57/matches?status=FINISHED&limit=5"),
        expect.anything(),
      );
      expect(matches).toHaveLength(2);
      expect(matches[0]!.status).toBe("finished");
    });

    it("accepts a custom limit", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const fetchSpy = mockFetchSuccess({ matches: [] });
      vi.stubGlobal("fetch", fetchSpy);

      await provider.getRecentMatches("57", 10);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.anything(),
      );
    });
  });

  // ── getSquad ─────────────────────────────────────────────────────

  describe("getSquad", () => {
    it("returns players from team response", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(TEAM_RESPONSE));

      const squad = await provider.getSquad("fdm-team-57");

      expect(squad).toHaveLength(2);
      expect(squad[0]!.name).toBe("Bukayo Saka");
      expect(squad[0]!.id).toBe("fdm-player-3269");
      expect(squad[0]!.teamId).toBe("fdm-team-57");
      expect(squad[0]!.shirtNumber).toBe(7);
    });

    it("returns empty array when team has no squad data", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal(
        "fetch",
        mockFetchSuccess({ id: 57, name: "Arsenal", shortName: "Arsenal", tla: "ARS", crest: "" }),
      );

      const squad = await provider.getSquad("fdm-team-57");
      expect(squad).toEqual([]);
    });

    it("returns empty array on API failure", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      const squad = await provider.getSquad("fdm-team-57");
      expect(squad).toEqual([]);
    });
  });

  // ── getStandings ─────────────────────────────────────────────────

  describe("getStandings", () => {
    it("fetches and maps TOTAL standings", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(STANDINGS_RESPONSE));

      const standings = await provider.getStandings("premier-league");

      expect(standings).toHaveLength(2);
      expect(standings[0]!.position).toBe(1);
      expect(standings[0]!.teamName).toBe("Arsenal");
      expect(standings[0]!.points).toBe(89);
      expect(standings[0]!.form).toBe("WWWDW");
      expect(standings[1]!.teamId).toBe("fdm-team-65");
    });

    it("returns empty array when API fails", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(500, "Internal Server Error"));

      const standings = await provider.getStandings("premier-league");
      expect(standings).toEqual([]);
    });
  });

  // ── DataProvider interface ───────────────────────────────────────

  describe("DataProvider interface", () => {
    it("fetchUpcomingMatches returns Match[] via getFixtures", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(MATCH_LIST_RESPONSE));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.id).toMatch(/^fdm-/);
    });

    it("fetchMatch throws on missing match (not returns null)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchStatus(404, "Not Found"));

      await expect(provider.fetchMatch("fdm-99999")).rejects.toThrow(
        /\[football-data-org-v2\]/,
      );
    });

    it("fetchTeam returns a Team object", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(TEAM_RESPONSE));

      const team = await provider.fetchTeam("fdm-team-57");
      expect(team.name).toBe("Arsenal");
      expect(team.id).toBe("fdm-team-57");
      expect(team.founded).toBe(1886);
    });

    it("fetchSquad delegates to getSquad", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(TEAM_RESPONSE));

      const squad = await provider.fetchSquad("fdm-team-57");
      expect(squad.length).toBeGreaterThan(0);
    });

    it("fetchForm returns W/D/L entries from recent matches", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(RECENT_MATCHES_RESPONSE));

      const form = await provider.fetchForm("fdm-team-57");
      // Arsenal: home 3-1 W, away 2-0 W
      expect(form).toHaveLength(2);
      expect(form[0]!.result).toBe("W");
      expect(form[0]!.goalsFor).toBe(3);
    });

    it("fetchH2H derives head-to-head from recent matches", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchSuccess(RECENT_MATCHES_RESPONSE));

      const h2h = await provider.fetchH2H("fdm-team-57", "fdm-team-73");
      // One meeting: Arsenal 3-1 Tottenham
      expect(h2h.totalMatches).toBe(1);
      expect(h2h.teamAWins).toBe(1);
    });

    it("fetchLineup returns empty lineup structure (unsupported)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });

      const lineup = await provider.fetchLineup("fdm-12345", "fdm-team-57");
      expect(lineup.matchId).toBe("fdm-12345");
      expect(lineup.starters).toEqual([]);
    });

    it("fetchMatchStats returns zeroed stats (unsupported)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });

      const stats = await provider.fetchMatchStats("fdm-12345");
      expect(stats.matchId).toBe("fdm-12345");
      expect(stats.homeXG).toBe(0);
    });

    it("fetchPrediction returns zeroed prediction (unsupported)", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });

      const prediction = await provider.fetchPrediction("fdm-12345");
      expect(prediction.matchId).toBe("fdm-12345");
      expect(prediction.confidence).toBe("low");
    });
  });

  // ── Error resilience ─────────────────────────────────────────────

  describe("error resilience", () => {
    it("fetchUpcomingMatches returns empty array on failure instead of throwing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchUpcomingMatches("premier-league");
      expect(result).toEqual([]);
      expect(provider.getHealth().status).toBe("degraded");
    });

    it("fetchSquad returns empty array on failure instead of throwing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchSquad("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("fetchForm returns empty array on failure instead of throwing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchForm("fdm-team-57");
      expect(result).toEqual([]);
    });

    it("fetchH2H returns empty record on failure instead of throwing", async () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      vi.stubGlobal("fetch", mockFetchNetworkError());

      const result = await provider.fetchH2H("fdm-team-57", "fdm-team-65");
      expect(result.totalMatches).toBe(0);
      expect(result.lastMeetings).toEqual([]);
    });
  });

  // ── Rate limiter integration ─────────────────────────────────────

  describe("rate limiter", () => {
    it("returns rate_limited when limiter rejects the request", async () => {
      // Create a limiter with 0 tokens so it always rejects.
      const exhaustedLimiter = new RateLimiter(0, 0, 60_000);
      const provider = new FootballDataOrgProvider(
        { apiKey: "key" },
        exhaustedLimiter,
      );
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const result = await provider.getFixtures("premier-league");

      expect(result).toEqual([]);
      expect(provider.getHealth().status).toBe("rate_limited");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── League code mapping ──────────────────────────────────────────

  describe("league code mapping", () => {
    const cases: [string, string][] = [
      ["premier-league", "PL"],
      ["la-liga", "PD"],
      ["bundesliga", "BL1"],
      ["serie-a", "SA"],
      ["ligue-1", "FL1"],
      ["champions-league", "CL"],
    ];

    for (const [slug, expectedCode] of cases) {
      it(`maps "${slug}" to "${expectedCode}"`, async () => {
        const provider = new FootballDataOrgProvider({ apiKey: "key" });
        const fetchSpy = mockFetchSuccess({ matches: [] });
        vi.stubGlobal("fetch", fetchSpy);

        await provider.getFixtures(slug);

        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining(`/competitions/${expectedCode}/matches`),
          expect.anything(),
        );
      });
    }
  });

  // ── Meta / capabilities ──────────────────────────────────────────

  describe("meta", () => {
    it("has correct id", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.id).toBe("football-data-org-v2");
    });

    it("requires API key", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      expect(provider.meta.requiresApiKey).toBe(true);
    });

    it("declares implemented capabilities", () => {
      const provider = new FootballDataOrgProvider({ apiKey: "key" });
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
      expect(caps.form).toBe(true);
      expect(caps.h2h).toBe(true);
    });
  });
});
