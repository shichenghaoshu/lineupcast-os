import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SportmonksProvider } from "../sportmonksProvider.js";
import { ApiFootballScaffoldProvider } from "../apiFootballProvider.js";

// ─── SportmonksProvider ──────────────────────────────────────────────

describe("SportmonksProvider", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv["SPORTMONKS_API_KEY"] = process.env["SPORTMONKS_API_KEY"];
    delete process.env["SPORTMONKS_API_KEY"];
  });

  afterEach(() => {
    if (savedEnv["SPORTMONKS_API_KEY"] === undefined) {
      delete process.env["SPORTMONKS_API_KEY"];
    } else {
      process.env["SPORTMONKS_API_KEY"] = savedEnv["SPORTMONKS_API_KEY"];
    }
  });

  describe("meta without token", () => {
    it("has correct id and name", () => {
      const provider = new SportmonksProvider();
      expect(provider.id).toBe("sportmonks-scaffold");
      expect(provider.meta.id).toBe("sportmonks-scaffold");
      expect(provider.meta.name).toBe("Sportmonks (Scaffold)");
    });

    it("requires API key", () => {
      const provider = new SportmonksProvider();
      expect(provider.meta.requiresApiKey).toBe(true);
      expect(provider.meta.tokenConfigured).toBe(false);
    });

    it("has needs-key status when token is missing", () => {
      const provider = new SportmonksProvider();
      expect(provider.meta.status).toBe("needs-key");
    });

    it("never crashes when token is missing", () => {
      const provider = new SportmonksProvider();
      expect(() => provider.meta).not.toThrow();
    });
  });

  describe("capabilities", () => {
    it("declares fixtures, match, team, squad, lineups, stats", () => {
      const provider = new SportmonksProvider();
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
      expect(caps.lineup).toBe(true);
      expect(caps.matchStats).toBe(true);
    });

    it("does not declare h2h, form, or prediction capabilities", () => {
      const provider = new SportmonksProvider();
      const caps = provider.meta.capabilities!;
      expect(caps.h2h).toBeUndefined();
      expect(caps.form).toBeUndefined();
      expect(caps.prediction).toBeUndefined();
    });
  });

  describe("methods return empty defaults without crashing", () => {
    it("fetchUpcomingMatches returns empty array", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchUpcomingMatches("premier-league");
      expect(result).toEqual([]);
    });

    it("fetchMatch returns empty match", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchMatch("some-match-id");
      expect(result.id).toBe("some-match-id");
      expect(result.homeTeamId).toBe("");
      expect(result.awayTeamId).toBe("");
      expect(result.status).toBe("scheduled");
    });

    it("fetchTeam returns empty team", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchTeam("some-team-id");
      expect(result.id).toBe("some-team-id");
      expect(result.name).toBe("some-team-id");
      expect(result.league).toBe("");
    });

    it("fetchSquad returns empty array", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchSquad("some-team-id");
      expect(result).toEqual([]);
    });

    it("fetchLineup returns empty lineup", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchLineup("match-1", "team-1");
      expect(result.matchId).toBe("match-1");
      expect(result.teamId).toBe("team-1");
      expect(result.formation).toBe("");
      expect(result.starters).toEqual([]);
      expect(result.substitutes).toEqual([]);
    });

    it("fetchMatchStats returns empty stats", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchMatchStats("match-1");
      expect(result.matchId).toBe("match-1");
      expect(result.homeXG).toBe(0);
      expect(result.awayXG).toBe(0);
    });

    it("fetchH2H returns empty H2H record", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchH2H("team-a", "team-b");
      expect(result.teamAId).toBe("team-a");
      expect(result.teamBId).toBe("team-b");
      expect(result.totalMatches).toBe(0);
    });

    it("fetchForm returns empty array", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchForm("team-1");
      expect(result).toEqual([]);
    });

    it("fetchPrediction returns empty prediction", async () => {
      const provider = new SportmonksProvider();
      const result = await provider.fetchPrediction("match-1");
      expect(result.matchId).toBe("match-1");
      expect(result.homeWin).toBe(0);
      expect(result.draw).toBe(0);
      expect(result.awayWin).toBe(0);
      expect(result.confidence).toBe("low");
    });
  });

  describe("health check", () => {
    it("reports adapter-not-configured when no token", async () => {
      const provider = new SportmonksProvider();
      const health = await provider.healthCheck();
      expect(health.status).toBe("adapter-not-configured");
      expect(health.configured).toBe(false);
    });

    it("reports not-implemented when token is present", async () => {
      process.env["SPORTMONKS_API_KEY"] = "test-key";
      const provider = new SportmonksProvider();
      const health = await provider.healthCheck();
      expect(health.status).toBe("not-implemented");
      expect(health.configured).toBe(true);
    });

    it("never throws", async () => {
      const provider = new SportmonksProvider();
      await expect(provider.healthCheck()).resolves.toBeDefined();
    });
  });
});

// ─── ApiFootballScaffoldProvider ─────────────────────────────────────

describe("ApiFootballScaffoldProvider", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv["API_FOOTBALL_KEY"] = process.env["API_FOOTBALL_KEY"];
    delete process.env["API_FOOTBALL_KEY"];
  });

  afterEach(() => {
    if (savedEnv["API_FOOTBALL_KEY"] === undefined) {
      delete process.env["API_FOOTBALL_KEY"];
    } else {
      process.env["API_FOOTBALL_KEY"] = savedEnv["API_FOOTBALL_KEY"];
    }
  });

  describe("meta without token", () => {
    it("has correct id and name", () => {
      const provider = new ApiFootballScaffoldProvider();
      expect(provider.id).toBe("api-football-scaffold");
      expect(provider.meta.id).toBe("api-football-scaffold");
      expect(provider.meta.name).toBe("API-Football (Scaffold)");
    });

    it("requires API key", () => {
      const provider = new ApiFootballScaffoldProvider();
      expect(provider.meta.requiresApiKey).toBe(true);
      expect(provider.meta.tokenConfigured).toBe(false);
    });

    it("has needs-key status when token is missing", () => {
      const provider = new ApiFootballScaffoldProvider();
      expect(provider.meta.status).toBe("needs-key");
    });

    it("never crashes when token is missing", () => {
      const provider = new ApiFootballScaffoldProvider();
      expect(() => provider.meta).not.toThrow();
    });
  });

  describe("capabilities", () => {
    it("declares fixtures, match, team, squad", () => {
      const provider = new ApiFootballScaffoldProvider();
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
    });

    it("does not declare lineup, matchStats, h2h, form, or prediction", () => {
      const provider = new ApiFootballScaffoldProvider();
      const caps = provider.meta.capabilities!;
      expect(caps.lineup).toBeUndefined();
      expect(caps.matchStats).toBeUndefined();
      expect(caps.h2h).toBeUndefined();
      expect(caps.form).toBeUndefined();
      expect(caps.prediction).toBeUndefined();
    });
  });

  describe("methods return empty defaults without crashing", () => {
    it("fetchUpcomingMatches returns empty array", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchUpcomingMatches("premier-league");
      expect(result).toEqual([]);
    });

    it("fetchMatch returns empty match", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchMatch("some-match-id");
      expect(result.id).toBe("some-match-id");
      expect(result.homeTeamId).toBe("");
      expect(result.awayTeamId).toBe("");
      expect(result.status).toBe("scheduled");
    });

    it("fetchTeam returns empty team", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchTeam("some-team-id");
      expect(result.id).toBe("some-team-id");
      expect(result.name).toBe("some-team-id");
      expect(result.league).toBe("");
    });

    it("fetchSquad returns empty array", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchSquad("some-team-id");
      expect(result).toEqual([]);
    });

    it("fetchLineup returns empty lineup", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchLineup("match-1", "team-1");
      expect(result.matchId).toBe("match-1");
      expect(result.teamId).toBe("team-1");
      expect(result.formation).toBe("");
      expect(result.starters).toEqual([]);
      expect(result.substitutes).toEqual([]);
    });

    it("fetchMatchStats returns empty stats", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchMatchStats("match-1");
      expect(result.matchId).toBe("match-1");
      expect(result.homeXG).toBe(0);
      expect(result.awayXG).toBe(0);
    });

    it("fetchH2H returns empty H2H record", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchH2H("team-a", "team-b");
      expect(result.teamAId).toBe("team-a");
      expect(result.teamBId).toBe("team-b");
      expect(result.totalMatches).toBe(0);
    });

    it("fetchForm returns empty array", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchForm("team-1");
      expect(result).toEqual([]);
    });

    it("fetchPrediction returns empty prediction", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const result = await provider.fetchPrediction("match-1");
      expect(result.matchId).toBe("match-1");
      expect(result.homeWin).toBe(0);
      expect(result.draw).toBe(0);
      expect(result.awayWin).toBe(0);
      expect(result.confidence).toBe("low");
    });
  });

  describe("health check", () => {
    it("reports adapter-not-configured when no token", async () => {
      const provider = new ApiFootballScaffoldProvider();
      const health = await provider.healthCheck();
      expect(health.status).toBe("adapter-not-configured");
      expect(health.configured).toBe(false);
    });

    it("reports not-implemented when token is present", async () => {
      process.env["API_FOOTBALL_KEY"] = "test-key";
      const provider = new ApiFootballScaffoldProvider();
      const health = await provider.healthCheck();
      expect(health.status).toBe("not-implemented");
      expect(health.configured).toBe(true);
    });

    it("never throws", async () => {
      const provider = new ApiFootballScaffoldProvider();
      await expect(provider.healthCheck()).resolves.toBeDefined();
    });
  });
});
