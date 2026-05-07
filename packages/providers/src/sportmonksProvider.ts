// @lineupcast/providers — SportmonksProvider: scaffold for Sportmonks API
//
// All methods return null/empty with graceful fallback.
// Requires SPORTMONKS_API_KEY env var to function.
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
  return process.env["SPORTMONKS_API_KEY"];
}

// ─── Provider Meta ───────────────────────────────────────────────────

function buildMeta(apiKeyPresent: boolean): Provider {
  return {
    id: "sportmonks-scaffold",
    name: "Sportmonks (Scaffold)",
    description:
      "Commercial football API with broad league coverage. " +
      "Requires paid subscription and SPORTMONKS_API_KEY.",
    baseUrl: "https://api.sportmonks.com/v3/football",
    requiresApiKey: true,
    tokenConfigured: apiKeyPresent,
    rateLimit: { requestsPerMinute: 30, requestsPerDay: 3000 },
    status: apiKeyPresent ? "partial" : "needs-key",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
      squad: true,
      lineup: true,
      matchStats: true,
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

// ─── SportmonksProvider ──────────────────────────────────────────────

/**
 * Scaffold provider for the Sportmonks API.
 *
 * Without a valid SPORTMONKS_API_KEY environment variable, all methods
 * return empty/default values.  Even with a key configured, the actual
 * API integration is not yet implemented — methods continue to return
 * safe defaults.
 *
 * This provider never throws.  All methods are wrapped in try/catch
 * to guarantee graceful fallback.
 *
 * Capabilities: fixtures, match, team, squad, lineups, stats
 *
 * Usage:
 * ```ts
 * // Set SPORTMONKS_API_KEY env var before importing
 * const provider = new SportmonksProvider();
 * ```
 */
export class SportmonksProvider implements DataProvider {
  readonly id = "sportmonks-scaffold";
  readonly meta: Provider;

  constructor() {
    const apiKeyPresent = !!getApiKey();
    this.meta = buildMeta(apiKeyPresent);
  }

  async fetchUpcomingMatches(_league: string): Promise<Match[]> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/fixtures
      return [];
    } catch {
      return [];
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/fixtures/{id}
      return emptyMatch(matchId);
    } catch {
      return emptyMatch(matchId);
    }
  }

  async fetchTeam(teamId: string): Promise<Team> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/teams/{id}
      return emptyTeam(teamId);
    } catch {
      return emptyTeam(teamId);
    }
  }

  async fetchSquad(_teamId: string): Promise<Player[]> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/squads/season/{season_id}
      return [];
    } catch {
      return [];
    }
  }

  async fetchLineup(matchId: string, teamId: string): Promise<Lineup> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/lineups/{fixture_id}
      return emptyLineup(matchId, teamId);
    } catch {
      return emptyLineup(matchId, teamId);
    }
  }

  async fetchMatchStats(matchId: string): Promise<MatchStats> {
    try {
      // API integration not yet implemented.
      // When implemented, call: GET /api/v3/football/fixture/{id}/statistics
      return emptyStats(matchId);
    } catch {
      return emptyStats(matchId);
    }
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    try {
      // API integration not yet implemented.
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
      // Sportmonks does not provide prediction data.
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
