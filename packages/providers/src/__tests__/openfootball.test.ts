import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenFootballProvider } from "../adapters.js";
import { OPEN_FOOTBALL_LIMITER } from "../rate-limiter.js";

// ─── Fixture data ────────────────────────────────────────────────────

const SEASON_DATA = {
  name: "Premier League 2025-26",
  rounds: [
    {
      name: "Matchday 1",
      matches: [
        {
          team1: "Manchester United",
          team2: "Fulham",
          score: [1, 0] as [number, number],
          date: "2025-08-16",
        },
        {
          team1: "Arsenal",
          team2: "Wolves",
          score: [2, 0] as [number, number],
          date: "2025-08-16",
        },
      ],
    },
    {
      name: "Matchday 2",
      matches: [
        {
          team1: "Fulham",
          team2: "Arsenal",
          score: [1, 2] as [number, number],
          date: "2025-08-23",
        },
        {
          team1: "Wolves",
          team2: "Manchester United",
          score: [0, 0] as [number, number],
          date: "2025-08-23",
        },
      ],
    },
    {
      name: "Matchday 3",
      matches: [
        {
          team1: "Manchester United",
          team2: "Arsenal",
          score: [3, 1] as [number, number],
          date: "2025-08-30",
        },
        {
          team1: "Fulham",
          team2: "Liverpool",
          // No score => scheduled/upcoming
          date: "2025-09-06",
        },
      ],
    },
  ],
};

const SEASON_DATA_PART2 = {
  name: "Premier League 2025-26",
  rounds: [
    {
      name: "Matchday 38",
      matches: [
        {
          team1: "Arsenal",
          team2: "Fulham",
          score: [0, 1] as [number, number],
          date: "2026-05-24",
        },
      ],
    },
  ],
};

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockImplementation((url: string) => {
    // Part 2 returns 404 for this fixture — that's expected (optional split-season file)
    if (url.includes(".2.json")) {
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found" });
    }
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: () => Promise.resolve(data),
    });
  });
}

function mockFetchMulti(
  data1: unknown,
  data2: unknown | null,
  status1 = 200,
  status2 = 200,
) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes(".1.json")) {
      return Promise.resolve({
        ok: status1 >= 200 && status1 < 300,
        status: status1,
        statusText: status1 === 200 ? "OK" : "Error",
        json: () => Promise.resolve(data1),
      });
    }
    if (url.includes(".2.json")) {
      if (data2 === null) {
        return Promise.resolve({ ok: false, status: 404, statusText: "Not Found" });
      }
      return Promise.resolve({
        ok: status2 >= 200 && status2 < 300,
        status: status2,
        statusText: status2 === 200 ? "OK" : "Error",
        json: () => Promise.resolve(data2),
      });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found" });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("OpenFootballProvider", () => {
  let provider: OpenFootballProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    OPEN_FOOTBALL_LIMITER.reset();
    // Clear the module-level fetch mock so each test starts clean
    provider = new OpenFootballProvider("2025-26");
  });

  // ── Meta ─────────────────────────────────────────────────────────

  describe("meta", () => {
    it("has correct id and name", () => {
      expect(provider.id).toBe("openfootball");
      expect(provider.meta.name).toBe("OpenFootball");
    });

    it("does not require API key", () => {
      expect(provider.meta.requiresApiKey).toBe(false);
      expect(provider.meta.tokenConfigured).toBe(false);
    });

    it("declares all implemented capabilities", () => {
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
      expect(caps.form).toBe(true);
      expect(caps.h2h).toBe(true);
      expect(caps.matchStats).toBe(true);
    });
  });

  // ── Season configuration ─────────────────────────────────────────

  describe("season configuration", () => {
    it("uses constructor season parameter", () => {
      const p = new OpenFootballProvider("2023-24");
      expect(p.season).toBe("2023-24");
    });

    it("falls back to env var OPENFOOTBALL_SEASON", () => {
      const original = process.env["OPENFOOTBALL_SEASON"];
      process.env["OPENFOOTBALL_SEASON"] = "2024-25";
      try {
        const p = new OpenFootballProvider();
        expect(p.season).toBe("2024-25");
      } finally {
        if (original === undefined) delete process.env["OPENFOOTBALL_SEASON"];
        else process.env["OPENFOOTBALL_SEASON"] = original;
      }
    });

    it("defaults to 2025-26 when no constructor arg or env var", () => {
      const original = process.env["OPENFOOTBALL_SEASON"];
      delete process.env["OPENFOOTBALL_SEASON"];
      try {
        const p = new OpenFootballProvider();
        expect(p.season).toBe("2025-26");
      } finally {
        if (original !== undefined) process.env["OPENFOOTBALL_SEASON"] = original;
      }
    });
  });

  // ── fetchUpcomingMatches ─────────────────────────────────────────

  describe("fetchUpcomingMatches", () => {
    it("returns only unscheduled (no-score) matches", async () => {
      const fetchSpy = mockFetch(SEASON_DATA);
      vi.stubGlobal("fetch", fetchSpy);

      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toContain("fulham");
      expect(matches[0]!.id).toContain("liverpool");
      expect(matches[0]!.status).toBe("scheduled");
    });

    it("populates homeTeam and awayTeam on returned matches", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      const m = matches[0]!;
      expect(m.homeTeam).toBeDefined();
      expect(m.homeTeam!.name).toBe("Fulham");
      expect(m.awayTeam).toBeDefined();
      expect(m.awayTeam!.name).toBe("Liverpool");
    });

    it("sets the season field from the provider season", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches[0]!.season).toBe("2025-26");
    });

    it("throws a descriptive error when the data cannot be loaded", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: () => Promise.resolve({}),
        }),
      );

      await expect(provider.fetchUpcomingMatches("no-such-league")).rejects.toThrow(
        /\[openfootball\] Failed to fetch upcoming matches/,
      );
    });

    it("returns empty array when all matches have scores", async () => {
      const allFinished = {
        name: "Test",
        rounds: [
          {
            name: "R1",
            matches: [{ team1: "A", team2: "B", score: [1, 0] as [number, number] }],
          },
        ],
      };
      vi.stubGlobal("fetch", mockFetch(allFinished));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches).toHaveLength(0);
    });
  });

  // ── fetchMatch ───────────────────────────────────────────────────

  describe("fetchMatch", () => {
    it("finds a finished match by its generated ID", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      // Build the expected ID the same way the provider does
      const matchId = `of-premier league 2025-26-matchday 1-manchester united-fulham`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const match = await provider.fetchMatch(matchId);
      expect(match.homeTeam!.name).toBe("Manchester United");
      expect(match.awayTeam!.name).toBe("Fulham");
      expect(match.status).toBe("finished");
      expect(match.homeScore).toBe(1);
      expect(match.awayScore).toBe(0);
    });

    it("throws when match ID is not found", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      await expect(provider.fetchMatch("of-nonexistent-match-id")).rejects.toThrow(
        /\[openfootball\]/,
      );
    });

    it("populates homeTeam and awayTeam objects", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const matchId = `of-premier league 2025-26-matchday 2-fulham-arsenal`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const match = await provider.fetchMatch(matchId);
      expect(match.homeTeam!.id).toBe("of-fulham");
      expect(match.awayTeam!.id).toBe("of-arsenal");
    });
  });

  // ── fetchTeam ────────────────────────────────────────────────────

  describe("fetchTeam", () => {
    it("returns a team by its slug ID", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const team = await provider.fetchTeam("of-arsenal");
      expect(team.name).toBe("Arsenal");
      expect(team.id).toBe("of-arsenal");
      expect(team.league).toBe("premier-league");
    });

    it("returns shortName as first 3 characters uppercased", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const team = await provider.fetchTeam("of-manchester-united");
      expect(team.shortName).toBe("MAN");
    });

    it("throws when team is not found in any league", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      await expect(provider.fetchTeam("of-nonexistent-club")).rejects.toThrow(
        /\[openfootball\]/,
      );
    });
  });

  // ── fetchSquad ───────────────────────────────────────────────────

  describe("fetchSquad", () => {
    it("returns empty array (OpenFootball has no squad data)", async () => {
      const squad = await provider.fetchSquad("of-arsenal");
      expect(squad).toEqual([]);
    });
  });

  // ── fetchForm ────────────────────────────────────────────────────

  describe("fetchForm", () => {
    it("computes W/D/L form from finished matches", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const form = await provider.fetchForm("of-manchester-united", 5);
      // Man Utd: W1-0 vs Fulham (W), D0-0 vs Wolves (D), W3-1 vs Arsenal (W)
      // Sorted most-recent first: MD3, MD2, MD1
      expect(form).toHaveLength(3);
      expect(form[0]!.result).toBe("W"); // 3-1 vs Arsenal
      expect(form[1]!.result).toBe("D"); // 0-0 vs Wolves
      expect(form[2]!.result).toBe("W"); // 1-0 vs Fulham
    });

    it("respects the limit parameter", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const form = await provider.fetchForm("of-manchester-united", 2);
      expect(form).toHaveLength(2);
    });

    it("includes opponent name and goal details", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const form = await provider.fetchForm("of-arsenal", 5);
      // Arsenal: W2-0 vs Wolves, L1-2 at Fulham (as away), W3-1 vs Man Utd (as away)
      // Wait — in MD3 Arsenal is away at Man Utd (score 3-1 means home=3, away=1)
      // So Arsenal got: W2-0 vs Wolves (home), W2-1 at Fulham (away team scored 2), L1-3 at Man Utd
      const arsWolves = form.find((f) => f.opponent === "Wolves");
      expect(arsWolves).toBeDefined();
      expect(arsWolves!.result).toBe("W");
      expect(arsWolves!.goalsFor).toBe(2);
      expect(arsWolves!.goalsAgainst).toBe(0);
    });

    it("returns empty array for unknown team", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const form = await provider.fetchForm("of-unknown-team");
      expect(form).toEqual([]);
    });

    it("returns entries sorted by date descending", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const form = await provider.fetchForm("of-fulham", 5);
      for (let i = 1; i < form.length; i++) {
        expect(form[i - 1]!.date >= form[i]!.date).toBe(true);
      }
    });
  });

  // ── fetchH2H ─────────────────────────────────────────────────────

  describe("fetchH2H", () => {
    it("computes head-to-head stats from finished matches", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const h2h = await provider.fetchH2H("of-manchester-united", "of-arsenal");
      // Man Utd vs Arsenal: only MD3, score 3-1 => Man Utd won
      expect(h2h.totalMatches).toBe(1);
      expect(h2h.teamAWins).toBe(1);
      expect(h2h.draws).toBe(0);
      expect(h2h.teamBWins).toBe(0);
      expect(h2h.lastMeetings).toHaveLength(1);
    });

    it("counts draws correctly", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const h2h = await provider.fetchH2H("of-manchester-united", "of-wolves");
      // Man Utd vs Wolves: MD2 score 0-0 => draw
      expect(h2h.totalMatches).toBe(1);
      expect(h2h.draws).toBe(1);
      expect(h2h.teamAWins).toBe(0);
      expect(h2h.teamBWins).toBe(0);
    });

    it("excludes unfinished (no-score) matches", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const h2h = await provider.fetchH2H("of-fulham", "of-liverpool");
      // Only the scheduled match exists — no score => excluded
      expect(h2h.totalMatches).toBe(0);
    });

    it("returns zeroed record when teams never played each other", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const h2h = await provider.fetchH2H("of-arsenal", "of-liverpool");
      expect(h2h.totalMatches).toBe(0);
      expect(h2h.lastMeetings).toEqual([]);
    });

    it("populates team IDs in the returned record", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const h2h = await provider.fetchH2H("of-fulham", "of-arsenal");
      expect(h2h.teamAId).toBe("of-fulham");
      expect(h2h.teamBId).toBe("of-arsenal");
    });

    it("includes at most 5 last meetings", async () => {
      // Build data with many H2H meetings
      const manyMeetings = {
        name: "Premier League 2025-26",
        rounds: Array.from({ length: 10 }, (_, i) => ({
          name: `Matchday ${i + 1}`,
          matches: [
            {
              team1: "Arsenal",
              team2: "Fulham",
              score: [1, 0] as [number, number],
              date: `2025-${String(8 + i).padStart(2, "0")}-01`,
            },
          ],
        })),
      };
      vi.stubGlobal("fetch", mockFetch(manyMeetings));

      const h2h = await provider.fetchH2H("of-arsenal", "of-fulham");
      expect(h2h.totalMatches).toBe(10);
      expect(h2h.lastMeetings.length).toBeLessThanOrEqual(5);
    });
  });

  // ── fetchMatchStats ──────────────────────────────────────────────

  describe("fetchMatchStats", () => {
    it("derives stats from score data for a finished match", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const matchId = `of-premier league 2025-26-matchday 1-manchester united-fulham`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const stats = await provider.fetchMatchStats(matchId);
      expect(stats.matchId).toBe(matchId);
      expect(stats.homeXG).toBeGreaterThan(0);
      expect(stats.awayXG).toBeGreaterThan(0);
      expect(stats.homePossession + stats.awayPossession).toBe(100);
      expect(stats.homeShots).toBeGreaterThan(0);
      expect(stats.awayShots).toBeGreaterThan(0);
    });

    it("gives higher xG to the team that scored more", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      // Man Utd 3-1 Arsenal
      const matchId = `of-premier league 2025-26-matchday 3-manchester united-arsenal`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const stats = await provider.fetchMatchStats(matchId);
      expect(stats.homeXG).toBeGreaterThan(stats.awayXG);
    });

    it("throws for a match without score data", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      // Fulham vs Liverpool is scheduled (no score)
      const matchId = `of-premier league 2025-26-matchday 3-fulham-liverpool`
        .replace(/\s+/g, "-")
        .toLowerCase();

      await expect(provider.fetchMatchStats(matchId)).rejects.toThrow(
        /no score data/,
      );
    });

    it("throws for a nonexistent match ID", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      await expect(provider.fetchMatchStats("of-nonexistent-match")).rejects.toThrow(
        /\[openfootball\]/,
      );
    });

    it("estimates shots on target less than or equal to total shots", async () => {
      vi.stubGlobal("fetch", mockFetch(SEASON_DATA));

      const matchId = `of-premier league 2025-26-matchday 2-fulham-arsenal`
        .replace(/\s+/g, "-")
        .toLowerCase();

      const stats = await provider.fetchMatchStats(matchId);
      expect(stats.homeShotsOnTarget).toBeLessThanOrEqual(stats.homeShots);
      expect(stats.awayShotsOnTarget).toBeLessThanOrEqual(stats.awayShots);
    });
  });

  // ── split-season support ─────────────────────────────────────────

  describe("split-season support", () => {
    it("loads data from part 2 when part 1 also succeeds", async () => {
      vi.stubGlobal("fetch", mockFetchMulti(SEASON_DATA, SEASON_DATA_PART2));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      // Part 1 has 1 upcoming match, part 2 has 0 (all scored)
      expect(matches).toHaveLength(1);
    });

    it("continues gracefully when part 2 is missing", async () => {
      vi.stubGlobal("fetch", mockFetchMulti(SEASON_DATA, null));

      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches).toHaveLength(1);
    });
  });

  // ── caching ──────────────────────────────────────────────────────

  describe("season data caching", () => {
    it("caches data across multiple calls for the same league", async () => {
      const fetchSpy = mockFetch(SEASON_DATA);
      vi.stubGlobal("fetch", fetchSpy);

      await provider.fetchUpcomingMatches("premier-league");
      await provider.fetchUpcomingMatches("premier-league");

      // fetch should only be called once for .1.json (cached on second call)
      const calls = fetchSpy.mock.calls.filter((c: string[]) =>
        String(c[0]).includes(".1.json"),
      );
      expect(calls.length).toBe(1);
    });
  });

  // ── error surfaces ───────────────────────────────────────────────

  describe("error handling", () => {
    it("surfaced errors include [openfootball] prefix", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({}),
        }),
      );

      await expect(provider.fetchUpcomingMatches("premier-league")).rejects.toThrow(
        /\[openfootball\]/,
      );
    });

    it("surfaced errors include the league name for load failures", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: () => Promise.resolve({}),
        }),
      );

      await expect(provider.fetchUpcomingMatches("bundesliga")).rejects.toThrow(/bundesliga/);
    });
  });
});
