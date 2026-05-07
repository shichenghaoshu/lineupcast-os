import { describe, it, expect } from "vitest";
import { CsvProvider } from "../csvProvider.js";
import type {
  CsvLineupRow,
  CsvPlayerStatsRow,
  CsvMatchHistoryRow,
} from "../csvProvider.js";

// ─── Test data ───────────────────────────────────────────────────────

const LINEUP_ROWS: CsvLineupRow[] = [
  {
    matchId: "match-1",
    teamId: "team-a",
    teamName: "Team Alpha",
    formation: "4-3-3",
    playerId: "p1",
    playerName: "John Striker",
    position: "ST",
    number: 9,
    isStarter: true,
    coach: "Coach A",
    nationality: "England",
    age: 25,
    rating: 82,
    captain: true,
  },
  {
    matchId: "match-1",
    teamId: "team-a",
    teamName: "Team Alpha",
    formation: "4-3-3",
    playerId: "p2",
    playerName: "Dave Midfielder",
    position: "CM",
    number: 8,
    isStarter: true,
    coach: "Coach A",
    nationality: "England",
    age: 28,
    rating: 78,
  },
  {
    matchId: "match-1",
    teamId: "team-a",
    teamName: "Team Alpha",
    formation: "4-3-3",
    playerId: "p3",
    playerName: "Sam Keeper",
    position: "GK",
    number: 1,
    isStarter: true,
    coach: "Coach A",
    nationality: "England",
    age: 30,
    rating: 75,
  },
  {
    matchId: "match-1",
    teamId: "team-a",
    teamName: "Team Alpha",
    formation: "4-3-3",
    playerId: "p4",
    playerName: "Ben Sub",
    position: "CB",
    number: 15,
    isStarter: false,
    coach: "Coach A",
    nationality: "England",
    age: 22,
    rating: 68,
  },
  {
    matchId: "match-1",
    teamId: "team-b",
    teamName: "Team Beta",
    formation: "4-4-2",
    playerId: "p5",
    playerName: "Leo Forward",
    position: "ST",
    number: 11,
    isStarter: true,
    coach: "Coach B",
    nationality: "Spain",
    age: 27,
    rating: 80,
  },
];

const STATS_ROWS: CsvPlayerStatsRow[] = [
  {
    playerId: "p1",
    playerName: "John Striker",
    teamId: "team-a",
    position: "ST",
    appearances: 30,
    goals: 15,
    assists: 5,
    yellowCards: 3,
    redCards: 0,
    minutesPlayed: 2500,
    rating: 82,
    xG: 12.5,
    xA: 4.2,
  },
  {
    playerId: "p2",
    playerName: "Dave Midfielder",
    teamId: "team-a",
    position: "CM",
    appearances: 28,
    goals: 3,
    assists: 10,
    yellowCards: 5,
    redCards: 1,
    minutesPlayed: 2300,
    rating: 78,
  },
  {
    playerId: "p5",
    playerName: "Leo Forward",
    teamId: "team-b",
    position: "ST",
    appearances: 32,
    goals: 20,
    assists: 3,
    yellowCards: 2,
    redCards: 0,
    minutesPlayed: 2700,
    rating: 85,
  },
];

const MATCH_HISTORY_ROWS: CsvMatchHistoryRow[] = [
  {
    matchId: "match-1",
    homeTeamId: "team-a",
    homeTeamName: "Team Alpha",
    awayTeamId: "team-b",
    awayTeamName: "Team Beta",
    kickoff: "2026-05-01T15:00:00Z",
    league: "premier-league",
    season: "2025-26",
    venue: "Alpha Stadium",
    homeScore: 2,
    awayScore: 1,
    status: "finished",
  },
  {
    matchId: "match-2",
    homeTeamId: "team-b",
    homeTeamName: "Team Beta",
    awayTeamId: "team-a",
    awayTeamName: "Team Alpha",
    kickoff: "2026-05-15T15:00:00Z",
    league: "premier-league",
    season: "2025-26",
    venue: "Beta Arena",
    status: "scheduled",
  },
  {
    matchId: "match-3",
    homeTeamId: "team-a",
    homeTeamName: "Team Alpha",
    awayTeamId: "team-c",
    awayTeamName: "Team Gamma",
    kickoff: "2026-04-20T15:00:00Z",
    league: "premier-league",
    season: "2025-26",
    venue: "Alpha Stadium",
    homeScore: 1,
    awayScore: 1,
    status: "finished",
  },
];

// ─── Tests ───────────────────────────────────────────────────────────

describe("CsvProvider", () => {
  describe("meta", () => {
    it("has correct id and name", () => {
      const provider = new CsvProvider({
        lineups: LINEUP_ROWS,
        playerStats: STATS_ROWS,
        matchHistory: MATCH_HISTORY_ROWS,
      });
      expect(provider.id).toBe("csv");
      expect(provider.meta.id).toBe("csv");
      expect(provider.meta.name).toBe("CSV Data Provider");
    });

    it("reports full status when data is provided", () => {
      const provider = new CsvProvider({
        lineups: LINEUP_ROWS,
        playerStats: STATS_ROWS,
        matchHistory: MATCH_HISTORY_ROWS,
      });
      expect(provider.meta.status).toBe("full");
      expect(provider.meta.freshness).toBe("just now");
    });

    it("reports placeholder status when no data is provided", () => {
      const provider = new CsvProvider();
      expect(provider.meta.status).toBe("placeholder");
      expect(provider.meta.freshness).toBe("never");
    });

    it("does not require API key", () => {
      const provider = new CsvProvider();
      expect(provider.meta.requiresApiKey).toBe(false);
      expect(provider.meta.tokenConfigured).toBe(false);
    });

    it("declares all capabilities", () => {
      const provider = new CsvProvider();
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
      expect(caps.lineup).toBe(true);
      expect(caps.matchStats).toBe(true);
      expect(caps.h2h).toBe(true);
      expect(caps.form).toBe(true);
      expect(caps.prediction).toBe(true);
    });
  });

  describe("with valid CSV data", () => {
    const provider = new CsvProvider({
      lineups: LINEUP_ROWS,
      playerStats: STATS_ROWS,
      matchHistory: MATCH_HISTORY_ROWS,
    });

    it("fetchUpcomingMatches returns scheduled matches for league", async () => {
      const matches = await provider.fetchUpcomingMatches("premier-league");
      expect(matches.length).toBeGreaterThanOrEqual(1);
      const scheduled = matches.find((m) => m.status === "scheduled");
      expect(scheduled).toBeDefined();
      expect(scheduled!.id).toBe("match-2");
    });

    it("fetchMatch returns a match by id", async () => {
      const match = await provider.fetchMatch("match-1");
      expect(match.id).toBe("match-1");
      expect(match.homeTeamId).toBe("team-a");
      expect(match.awayTeamId).toBe("team-b");
      expect(match.homeScore).toBe(2);
      expect(match.awayScore).toBe(1);
      expect(match.status).toBe("finished");
    });

    it("fetchMatch returns empty match for unknown id", async () => {
      const match = await provider.fetchMatch("nonexistent");
      expect(match.id).toBe("nonexistent");
      expect(match.homeTeamId).toBe("");
      expect(match.status).toBe("scheduled");
    });

    it("fetchTeam returns team data from match history", async () => {
      const team = await provider.fetchTeam("team-a");
      expect(team.id).toBe("team-a");
      expect(team.name).toBe("Team Alpha");
      expect(team.league).toBe("premier-league");
    });

    it("fetchTeam returns team data from lineup data when not in match history", async () => {
      // "team-a" is in both, but let's test with a team only in lineups
      const lineupOnlyProvider = new CsvProvider({
        lineups: [{ ...LINEUP_ROWS[0], teamId: "team-x", teamName: "Team Xtra" }],
      });
      const team = await lineupOnlyProvider.fetchTeam("team-x");
      expect(team.id).toBe("team-x");
      expect(team.name).toBe("Team Xtra");
    });

    it("fetchTeam returns safe default for unknown team", async () => {
      const team = await provider.fetchTeam("unknown-team");
      expect(team.id).toBe("unknown-team");
      expect(team.name).toBe("unknown-team");
    });

    it("fetchSquad returns players from lineups and stats", async () => {
      const squad = await provider.fetchSquad("team-a");
      expect(squad.length).toBeGreaterThanOrEqual(3);
      const names = squad.map((p) => p.name);
      expect(names).toContain("John Striker");
      expect(names).toContain("Dave Midfielder");
      expect(names).toContain("Sam Keeper");
      expect(names).toContain("Ben Sub");
    });

    it("fetchSquad returns empty array for unknown team", async () => {
      const squad = await provider.fetchSquad("unknown");
      expect(squad).toEqual([]);
    });

    it("fetchLineup returns starters and substitutes", async () => {
      const lineup = await provider.fetchLineup("match-1", "team-a");
      expect(lineup.formation).toBe("4-3-3");
      expect(lineup.coach).toBe("Coach A");
      expect(lineup.starters.length).toBe(3);
      expect(lineup.substitutes.length).toBe(1);
      expect(lineup.substitutes[0]!.name).toBe("Ben Sub");
    });

    it("fetchLineup returns empty lineup for unknown match/team", async () => {
      const lineup = await provider.fetchLineup("bad", "bad");
      expect(lineup.formation).toBe("");
      expect(lineup.starters).toEqual([]);
      expect(lineup.substitutes).toEqual([]);
    });

    it("fetchMatchStats derives stats from score", async () => {
      const stats = await provider.fetchMatchStats("match-1");
      expect(stats.matchId).toBe("match-1");
      expect(stats.homeXG).toBeGreaterThan(0);
      expect(stats.awayXG).toBeGreaterThan(0);
      expect(stats.homePossession + stats.awayPossession).toBe(100);
    });

    it("fetchMatchStats returns zeros for unknown match", async () => {
      const stats = await provider.fetchMatchStats("bad");
      expect(stats.matchId).toBe("bad");
      expect(stats.homeXG).toBe(0);
    });

    it("fetchH2H computes head-to-head correctly", async () => {
      const h2h = await provider.fetchH2H("team-a", "team-b");
      expect(h2h.totalMatches).toBe(1);
      expect(h2h.teamAWins).toBe(1);
      expect(h2h.draws).toBe(0);
      expect(h2h.teamBWins).toBe(0);
    });

    it("fetchH2H returns empty for teams that never played", async () => {
      const h2h = await provider.fetchH2H("team-a", "team-z");
      expect(h2h.totalMatches).toBe(0);
    });

    it("fetchForm returns form entries sorted by date", async () => {
      const form = await provider.fetchForm("team-a");
      expect(form.length).toBeGreaterThanOrEqual(1);
      // Most recent first
      expect(form[0]!.matchId).toBe("match-1");
      expect(form[0]!.result).toBe("W");
      expect(form[0]!.goalsFor).toBe(2);
      expect(form[0]!.goalsAgainst).toBe(1);
    });

    it("fetchForm respects limit parameter", async () => {
      const form = await provider.fetchForm("team-a", 1);
      expect(form.length).toBe(1);
    });

    it("fetchForm returns empty for unknown team", async () => {
      const form = await provider.fetchForm("unknown");
      expect(form).toEqual([]);
    });

    it("fetchPrediction returns safe defaults (no prediction data from CSV)", async () => {
      const pred = await provider.fetchPrediction("match-1");
      expect(pred.matchId).toBe("match-1");
      expect(pred.homeWin).toBe(0);
      expect(pred.draw).toBe(0);
      expect(pred.awayWin).toBe(0);
      expect(pred.confidence).toBe("low");
    });
  });

  describe("with empty data", () => {
    const provider = new CsvProvider();

    it("fetchUpcomingMatches returns empty array", async () => {
      const matches = await provider.fetchUpcomingMatches("any-league");
      expect(matches).toEqual([]);
    });

    it("fetchMatch returns empty match", async () => {
      const match = await provider.fetchMatch("any-id");
      expect(match.id).toBe("any-id");
      expect(match.homeTeamId).toBe("");
    });

    it("fetchTeam returns safe default", async () => {
      const team = await provider.fetchTeam("any-team");
      expect(team.id).toBe("any-team");
    });

    it("fetchSquad returns empty array", async () => {
      const squad = await provider.fetchSquad("any-team");
      expect(squad).toEqual([]);
    });

    it("fetchLineup returns empty lineup", async () => {
      const lineup = await provider.fetchLineup("any", "any");
      expect(lineup.starters).toEqual([]);
    });

    it("fetchMatchStats returns zeros", async () => {
      const stats = await provider.fetchMatchStats("any");
      expect(stats.homeXG).toBe(0);
    });

    it("fetchH2H returns empty record", async () => {
      const h2h = await provider.fetchH2H("a", "b");
      expect(h2h.totalMatches).toBe(0);
    });

    it("fetchForm returns empty array", async () => {
      const form = await provider.fetchForm("any");
      expect(form).toEqual([]);
    });

    it("fetchPrediction returns defaults", async () => {
      const pred = await provider.fetchPrediction("any");
      expect(pred.confidence).toBe("low");
    });
  });

  describe("capabilities", () => {
    it("always declares all capabilities regardless of data", () => {
      const withData = new CsvProvider({ matchHistory: MATCH_HISTORY_ROWS });
      const withoutData = new CsvProvider();

      const caps1 = withData.meta.capabilities!;
      const caps2 = withoutData.meta.capabilities!;

      expect(caps1.upcomingMatches).toBe(true);
      expect(caps1.lineup).toBe(true);
      expect(caps1.prediction).toBe(true);
      expect(caps2.upcomingMatches).toBe(true);
      expect(caps2.lineup).toBe(true);
      expect(caps2.prediction).toBe(true);
    });
  });

  describe("never throws", () => {
    const provider = new CsvProvider();

    it("fetchUpcomingMatches never throws", async () => {
      await expect(provider.fetchUpcomingMatches("any")).resolves.toBeDefined();
    });

    it("fetchMatch never throws", async () => {
      await expect(provider.fetchMatch("any")).resolves.toBeDefined();
    });

    it("fetchTeam never throws", async () => {
      await expect(provider.fetchTeam("any")).resolves.toBeDefined();
    });

    it("fetchSquad never throws", async () => {
      await expect(provider.fetchSquad("any")).resolves.toBeDefined();
    });

    it("fetchLineup never throws", async () => {
      await expect(provider.fetchLineup("any", "any")).resolves.toBeDefined();
    });

    it("fetchMatchStats never throws", async () => {
      await expect(provider.fetchMatchStats("any")).resolves.toBeDefined();
    });

    it("fetchH2H never throws", async () => {
      await expect(provider.fetchH2H("a", "b")).resolves.toBeDefined();
    });

    it("fetchForm never throws", async () => {
      await expect(provider.fetchForm("any")).resolves.toBeDefined();
    });

    it("fetchPrediction never throws", async () => {
      await expect(provider.fetchPrediction("any")).resolves.toBeDefined();
    });
  });

  describe("data from player stats only (no lineup data)", () => {
    const provider = new CsvProvider({ playerStats: STATS_ROWS });

    it("fetchSquad returns players from stats", async () => {
      const squad = await provider.fetchSquad("team-a");
      expect(squad.length).toBe(2);
      const names = squad.map((p) => p.name);
      expect(names).toContain("John Striker");
      expect(names).toContain("Dave Midfielder");
    });

    it("fetchLineup returns empty when no lineup data", async () => {
      const lineup = await provider.fetchLineup("match-1", "team-a");
      expect(lineup.formation).toBe("");
      expect(lineup.starters).toEqual([]);
    });
  });
});
