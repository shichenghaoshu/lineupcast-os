// @lineupcast/providers — ApiFootballScaffoldProvider: scaffold for API-Football
//
// All methods return null/empty with graceful fallback.
// Requires API_FOOTBALL_KEY env var to function.
// Never throws — always returns safe defaults.

import type {
  Match,
  Team,
  Player,
  Lineup,
  Prediction,
  MatchStats,
  H2HRecord,
  FormEntry,
  Provider,
} from "@lineupcast/schema";
import type { DataProvider } from "./data-provider.js";

// ─── Configuration ───────────────────────────────────────────────────

function getApiKey(): string | undefined {
  return process.env["API_FOOTBALL_KEY"];
}

// ─── Provider Meta ───────────────────────────────────────────────────

function buildMeta(apiKeyPresent: boolean): Provider {
  return {
    id: "api-football-scaffold",
    name: "API-Football (Scaffold)",
    description:
      "Scaffold for API-Football via RapidAPI. " +
      "Requires API_FOOTBALL_KEY. This is a placeholder — " +
      "use the full ApiFootballProvider for working integration.",
    baseUrl: "https://v3.football.api-sports.io",
    requiresApiKey: true,
    tokenConfigured: apiKeyPresent,
    rateLimit: { requestsPerMinute: 10, requestsPerDay: 100 },
    status: apiKeyPresent ? "partial" : "needs-key",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
      squad: true,
    },
    freshness: "never",
    errorCount: 0,
  };
}

// ─── Empty/default returns ───────────────────────────────────────────

function emptyMatch(matchId: string): Match {
  return {
    id: matchId,
    homeTeamId: "",
    awayTeamId: "",
    kickoff: "",
    league: "",
    status: "scheduled",
  };
}

function emptyTeam(teamId: string): Team {
  return {
    id: teamId,
    name: teamId,
    shortName: teamId.substring(0, 3).toUpperCase(),
    league: "",
  };
}

function emptyLineup(matchId: string, teamId: string): Lineup {
  return {
    matchId,
    teamId,
    formation: "",
    starters: [],
    substitutes: [],
  };
}

function emptyStats(matchId: string): MatchStats {
  return {
    matchId,
    homeXG: 0,
    awayXG: 0,
    homePossession: 0,
    awayPossession: 0,
    homeShots: 0,
    awayShots: 0,
  };
}

function emptyH2H(teamAId: string, teamBId: string): H2HRecord {
  return {
    teamAId,
    teamBId,
    totalMatches: 0,
    teamAWins: 0,
    draws: 0,
    teamBWins: 0,
    lastMeetings: [],
  };
}

function emptyPrediction(matchId: string): Prediction {
  return {
    matchId,
    homeWin: 0,
    draw: 0,
    awayWin: 0,
    expectedHomeGoals: 0,
    expectedAwayGoals: 0,
    confidence: "low",
  };
}

// ─── ApiFootballScaffoldProvider ─────────────────────────────────────

/**
 * Scaffold provider for the API-Football (RapidAPI) service.
 *
 * Without a valid API_FOOTBALL_KEY environment variable, all methods
 * return empty/default values.  Even with a key configured, the actual
 * API integration is not yet implemented — methods continue to return
 * safe defaults.
 *
 * This provider never throws.  All methods are wrapped in try/catch
 * to guarantee graceful fallback.
 *
 * Capabilities: fixtures, match, team, squad
 *
 * Usage:
 * ```ts
 * // Set API_FOOTBALL_KEY env var before importing
 * const provider = new ApiFootballScaffoldProvider();
 * ```
 */
export class ApiFootballScaffoldProvider implements DataProvider {
  readonly id = "api-football-scaffold";
  readonly meta: Provider;

  constructor() {
    const apiKeyPresent = !!getApiKey();
    this.meta = buildMeta(apiKeyPresent);
  }

  async fetchUpcomingMatches(_league: string): Promise<Match[]> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /fixtures?league={id}&next={count}
      return [];
    } catch {
      return [];
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /fixtures?id={id}
      return emptyMatch(matchId);
    } catch {
      return emptyMatch(matchId);
    }
  }

  async fetchTeam(teamId: string): Promise<Team> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /teams?id={id}
      return emptyTeam(teamId);
    } catch {
      return emptyTeam(teamId);
    }
  }

  async fetchSquad(_teamId: string): Promise<Player[]> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /players/squads?team={id}
      return [];
    } catch {
      return [];
    }
  }

  async fetchLineup(matchId: string, teamId: string): Promise<Lineup> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /fixtures/lineups?fixture={id}
      return emptyLineup(matchId, teamId);
    } catch {
      return emptyLineup(matchId, teamId);
    }
  }

  async fetchMatchStats(matchId: string): Promise<MatchStats> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /fixtures/statistics?fixture={id}
      return emptyStats(matchId);
    } catch {
      return emptyStats(matchId);
    }
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /fixtures/headtohead?h2h={id1}-{id2}
      return emptyH2H(teamAId, teamBId);
    } catch {
      return emptyH2H(teamAId, teamBId);
    }
  }

  async fetchForm(_teamId: string, _limit?: number): Promise<FormEntry[]> {
    try {
      // API integration not yet implemented.
      return [];
    } catch {
      return [];
    }
  }

  async fetchPrediction(matchId: string): Promise<Prediction> {
    try {
      // API-Football does not provide prediction data.
      return emptyPrediction(matchId);
    } catch {
      return emptyPrediction(matchId);
    }
  }

  /** Health check — returns true if the provider is operational. */
  async healthCheck(): Promise<{ status: string; configured: boolean }> {
    try {
      const configured = !!getApiKey();
      return {
        status: configured ? "not-implemented" : "adapter-not-configured",
        configured,
      };
    } catch {
      return {
        status: "error",
        configured: false,
      };
    }
  }
}
