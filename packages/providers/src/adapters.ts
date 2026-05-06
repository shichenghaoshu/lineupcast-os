// @lineupcast/providers — placeholder adapters for external data sources
//
// Each adapter implements DataProvider but throws on every method until
// the concrete HTTP + parsing logic is filled in. The purpose is to
// document the expected provider shape and env-var requirements.

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

// ─── Base class with safe defaults ───────────────────────────────────

abstract class BasePlaceholder implements DataProvider {
  abstract readonly id: string;
  abstract readonly meta: Provider;

  async fetchUpcomingMatches(_league: string): Promise<Match[]> {
    return this.notImplemented("fetchUpcomingMatches");
  }
  async fetchMatch(_matchId: string): Promise<Match> {
    return this.notImplemented("fetchMatch");
  }
  async fetchTeam(_teamId: string): Promise<Team> {
    return this.notImplemented("fetchTeam");
  }
  async fetchSquad(_teamId: string): Promise<Player[]> {
    return this.notImplemented("fetchSquad");
  }
  async fetchLineup(_matchId: string, _teamId: string): Promise<Lineup> {
    return this.notImplemented("fetchLineup");
  }
  async fetchMatchStats(_matchId: string): Promise<MatchStats> {
    return this.notImplemented("fetchMatchStats");
  }
  async fetchH2H(_teamAId: string, _teamBId: string): Promise<H2HRecord> {
    return this.notImplemented("fetchH2H");
  }
  async fetchForm(_teamId: string, _limit?: number): Promise<FormEntry[]> {
    return this.notImplemented("fetchForm");
  }
  async fetchPrediction(_matchId: string): Promise<Prediction> {
    return this.notImplemented("fetchPrediction");
  }

  private notImplemented(method: string): never {
    throw new Error(`[${this.id}] ${method} not implemented — this is a placeholder adapter.`);
  }
}

// ─── OpenFootball (openfootball.github.io) ──────────────────────────

export class OpenFootballProvider extends BasePlaceholder {
  readonly id = "openfootball";
  readonly meta: Provider = {
    id: "openfootball",
    name: "OpenFootball",
    description: "Free open-source football data (JSON). No API key required.",
    baseUrl: "https://raw.githubusercontent.com/openfootball/football.json/master",
    requiresApiKey: false,
    tokenConfigured: false,
  };
}

// ─── StatsBomb Open Data ─────────────────────────────────────────────

export class StatsBombProvider extends BasePlaceholder {
  readonly id = "statsbomb";
  readonly meta: Provider = {
    id: "statsbomb",
    name: "StatsBomb Open Data",
    description: "Free event-level data from select competitions on GitHub. No API key required.",
    baseUrl: "https://raw.githubusercontent.com/statsbomb/open-data/master",
    requiresApiKey: false,
    tokenConfigured: false,
  };
}

// ─── football-data.org ──────────────────────────────────────────────

export class FootballDataOrgProvider extends BasePlaceholder {
  readonly id = "football-data-org";
  readonly meta: Provider = {
    id: "football-data-org",
    name: "football-data.org",
    description: "Free tier available. Provides fixtures, standings, and match data for major European leagues.",
    baseUrl: "https://api.football-data.org/v4",
    requiresApiKey: true,
    tokenConfigured: !!process.env["FOOTBALL_DATA_ORG_TOKEN"],
    rateLimit: { requestsPerMinute: 10 },
  };
}

// ─── Sportmonks ─────────────────────────────────────────────────────

export class SportmonksProvider extends BasePlaceholder {
  readonly id = "sportmonks";
  readonly meta: Provider = {
    id: "sportmonks",
    name: "Sportmonks",
    description: "Commercial football API with broad league coverage. Requires paid subscription.",
    baseUrl: "https://api.sportmonks.com/v3/football",
    requiresApiKey: true,
    tokenConfigured: !!process.env["SPORTMONKS_API_TOKEN"],
    rateLimit: { requestsPerMinute: 30 },
  };
}

// ─── API-FOOTBALL ───────────────────────────────────────────────────

export class ApiFootballProvider extends BasePlaceholder {
  readonly id = "api-football";
  readonly meta: Provider = {
    id: "api-football",
    name: "API-FOOTBALL",
    description: "Comprehensive football API via RapidAPI. Free tier with limited requests.",
    baseUrl: "https://v3.football.api-sports.io",
    requiresApiKey: true,
    tokenConfigured: !!process.env["API_FOOTBALL_KEY"],
    rateLimit: { requestsPerMinute: 10, requestsPerDay: 100 },
  };
}
