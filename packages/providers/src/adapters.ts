// @lineupcast/providers — data provider adapters
//
// Real implementations for football-data.org, OpenFootball, and API-Football.
// Other providers remain as placeholders.

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
import {
  FOOTBALL_DATA_ORG_LIMITER,
  API_FOOTBALL_LIMITER,
  OPEN_FOOTBALL_LIMITER,
  type RateLimiter,
} from "./rate-limiter.js";

// ─── Helpers ─────────────────────────────────────────────────────────

async function fetchJson<T>(
  url: string,
  headers: Record<string, string> = {},
  limiter?: RateLimiter,
  timeoutMs = 10_000,
): Promise<T> {
  if (limiter && !limiter.tryAcquire()) {
    throw new Error(`Rate limit exceeded for ${url}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set. Configure it to use this provider.`);
  }
  return value;
}

// ─── Base class with safe defaults ───────────────────────────────────

abstract class BaseAdapter implements DataProvider {
  abstract readonly id: string;
  abstract readonly meta: Provider;

  async fetchUpcomingMatches(_league: string): Promise<Match[]> {
    throw new Error(`[${this.id}] fetchUpcomingMatches not implemented`);
  }
  async fetchMatch(_matchId: string): Promise<Match> {
    throw new Error(`[${this.id}] fetchMatch not implemented`);
  }
  async fetchTeam(_teamId: string): Promise<Team> {
    throw new Error(`[${this.id}] fetchTeam not implemented`);
  }
  async fetchSquad(_teamId: string): Promise<Player[]> {
    throw new Error(`[${this.id}] fetchSquad not implemented`);
  }
  async fetchLineup(_matchId: string, _teamId: string): Promise<Lineup> {
    throw new Error(`[${this.id}] fetchLineup not implemented`);
  }
  async fetchMatchStats(_matchId: string): Promise<MatchStats> {
    throw new Error(`[${this.id}] fetchMatchStats not implemented`);
  }
  async fetchH2H(_teamAId: string, _teamBId: string): Promise<H2HRecord> {
    throw new Error(`[${this.id}] fetchH2H not implemented`);
  }
  async fetchForm(_teamId: string, _limit?: number): Promise<FormEntry[]> {
    throw new Error(`[${this.id}] fetchForm not implemented`);
  }
  async fetchPrediction(_matchId: string): Promise<Prediction> {
    throw new Error(`[${this.id}] fetchPrediction not implemented`);
  }
}

// ─── football-data.org ──────────────────────────────────────────────

interface FDMTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface FDMMatch {
  id: number;
  competition: { name: string; code: string };
  utcDate: string;
  status: string;
  homeTeam: FDMTeam & { score?: number | null };
  awayTeam: FDMTeam & { score?: number | null };
}

interface FDMResponse {
  matches: FDMMatch[];
}

const LEAGUE_CODES: Record<string, string> = {
  "premier-league": "PL",
  "la-liga": "PD",
  "bundesliga": "BL1",
  "serie-a": "SA",
  "ligue-1": "FL1",
  "champions-league": "CL",
};

export class FootballDataOrgProvider extends BaseAdapter {
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

  private get token(): string {
    return requireEnv("FOOTBALL_DATA_ORG_TOKEN");
  }

  private get headers(): Record<string, string> {
    return { "X-Auth-Token": this.token };
  }

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    const code = LEAGUE_CODES[league] || league.toUpperCase();
    const data = await fetchJson<FDMResponse>(
      `https://api.football-data.org/v4/competitions/${code}/matches?status=SCHEDULED&limit=10`,
      this.headers,
      FOOTBALL_DATA_ORG_LIMITER,
    );
    return data.matches.map((m) => ({
      id: `fdm-${m.id}`,
      homeTeamId: `fdm-team-${m.homeTeam.id}`,
      awayTeamId: `fdm-team-${m.awayTeam.id}`,
      homeTeam: { id: `fdm-team-${m.homeTeam.id}`, name: m.homeTeam.name, shortName: m.homeTeam.shortName || m.homeTeam.tla, league, crest: m.homeTeam.crest },
      awayTeam: { id: `fdm-team-${m.awayTeam.id}`, name: m.awayTeam.name, shortName: m.awayTeam.shortName || m.awayTeam.tla, league, crest: m.awayTeam.crest },
      kickoff: m.utcDate,
      league,
      venue: "",
      status: m.status === "FINISHED" ? "finished" : m.status === "IN_PLAY" ? "live" : "scheduled",
      homeScore: m.homeTeam.score ?? undefined,
      awayScore: m.awayTeam.score ?? undefined,
    }));
  }

  async fetchMatch(matchId: string): Promise<Match> {
    const id = matchId.replace("fdm-", "");
    const data = await fetchJson<FDMMatch>(
      `https://api.football-data.org/v4/matches/${id}`,
      this.headers,
      FOOTBALL_DATA_ORG_LIMITER,
    );
    const league = data.competition.code;
    return {
      id: `fdm-${data.id}`,
      homeTeamId: `fdm-team-${data.homeTeam.id}`,
      awayTeamId: `fdm-team-${data.awayTeam.id}`,
      homeTeam: { id: `fdm-team-${data.homeTeam.id}`, name: data.homeTeam.name, shortName: data.homeTeam.shortName || data.homeTeam.tla, league },
      awayTeam: { id: `fdm-team-${data.awayTeam.id}`, name: data.awayTeam.name, shortName: data.awayTeam.shortName || data.awayTeam.tla, league },
      kickoff: data.utcDate,
      league,
      venue: "",
      status: data.status === "FINISHED" ? "finished" : data.status === "IN_PLAY" ? "live" : "scheduled",
      homeScore: data.homeTeam.score ?? undefined,
      awayScore: data.awayTeam.score ?? undefined,
    };
  }

  async fetchTeam(teamId: string): Promise<Team> {
    const id = teamId.replace("fdm-team-", "");
    const data = await fetchJson<FDMTeam>(
      `https://api.football-data.org/v4/teams/${id}`,
      this.headers,
      FOOTBALL_DATA_ORG_LIMITER,
    );
    return {
      id: `fdm-team-${data.id}`,
      name: data.name,
      shortName: data.shortName || data.tla,
      league: "",
      crest: data.crest,
    };
  }
}

// ─── OpenFootball ────────────────────────────────────────────────────

interface OFRound {
  name: string;
  matches: {
    team1: string;
    team2: string;
    score?: [number, number];
    date?: string;
  }[];
}

interface OFSeason {
  name: string;
  rounds: OFRound[];
}

export class OpenFootballProvider extends BaseAdapter {
  readonly id = "openfootball";
  readonly meta: Provider = {
    id: "openfootball",
    name: "OpenFootball",
    description: "Free open-source football data (JSON). No API key required.",
    baseUrl: "https://raw.githubusercontent.com/openfootball/football.json/master",
    requiresApiKey: false,
    tokenConfigured: false,
  };

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    const season = "2025-26";
    const leagueFile = league.replace("-", ".");
    const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${leagueFile}.1.json`;

    try {
      const data = await fetchJson<OFSeason>(url, {}, OPEN_FOOTBALL_LIMITER);
      const matches: Match[] = [];
      for (const round of data.rounds) {
        for (const m of round.matches) {
          const id = `of-${data.name}-${round.name}-${m.team1}-${m.team2}`.replace(/\s+/g, "-").toLowerCase();
          matches.push({
            id,
            homeTeamId: `of-${m.team1.replace(/\s+/g, "-").toLowerCase()}`,
            awayTeamId: `of-${m.team2.replace(/\s+/g, "-").toLowerCase()}`,
            kickoff: m.date || "",
            league,
            venue: "",
            status: m.score ? "finished" : "scheduled",
            homeScore: m.score?.[0],
            awayScore: m.score?.[1],
          });
        }
      }
      return matches.slice(0, 20);
    } catch {
      return [];
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    throw new Error(`[openfootball] fetchMatch not fully implemented for id: ${matchId}`);
  }
}

// ─── API-FOOTBALL ────────────────────────────────────────────────────

interface AFTeam {
  team: { id: number; name: string; code: string; logo: string };
  venue?: { name: string };
}

interface AFFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: AFTeam["team"]; away: AFTeam["team"] };
  goals: { home: number | null; away: number | null };
  league: { name: string; id: number };
}

interface AFResponse {
  response: AFFixture[];
}

const AF_LEAGUE_IDS: Record<string, number> = {
  "premier-league": 39,
  "la-liga": 140,
  "bundesliga": 78,
  "serie-a": 135,
  "ligue-1": 61,
  "champions-league": 2,
};

export class ApiFootballProvider extends BaseAdapter {
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

  private get headers(): Record<string, string> {
    return { "x-apisports-key": requireEnv("API_FOOTBALL_KEY") };
  }

  private mapStatus(short: string): "scheduled" | "live" | "finished" {
    if (["NS", "TBD", "PST"].includes(short)) return "scheduled";
    if (["1H", "HT", "2H", "ET", "P", "BT"].includes(short)) return "live";
    return "finished";
  }

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    const leagueId = AF_LEAGUE_IDS[league] || 39;
    const data = await fetchJson<AFResponse>(
      `https://v3.football.api-sports.io/fixtures?league=${leagueId}&next=10`,
      this.headers,
      API_FOOTBALL_LIMITER,
    );
    return data.response.map((f) => ({
      id: `af-${f.fixture.id}`,
      homeTeamId: `af-team-${f.teams.home.id}`,
      awayTeamId: `af-team-${f.teams.away.id}`,
      homeTeam: { id: `af-team-${f.teams.home.id}`, name: f.teams.home.name, shortName: f.teams.home.code, league, crest: f.teams.home.logo },
      awayTeam: { id: `af-team-${f.teams.away.id}`, name: f.teams.away.name, shortName: f.teams.away.code, league, crest: f.teams.away.logo },
      kickoff: f.fixture.date,
      league,
      venue: "",
      status: this.mapStatus(f.fixture.status.short),
      homeScore: f.goals.home ?? undefined,
      awayScore: f.goals.away ?? undefined,
    }));
  }

  async fetchMatch(matchId: string): Promise<Match> {
    const id = matchId.replace("af-", "");
    const data = await fetchJson<AFResponse>(
      `https://v3.football.api-sports.io/fixtures?id=${id}`,
      this.headers,
      API_FOOTBALL_LIMITER,
    );
    const f = data.response[0];
    if (!f) throw new Error(`Match ${matchId} not found`);
    const league = f.league.name;
    return {
      id: `af-${f.fixture.id}`,
      homeTeamId: `af-team-${f.teams.home.id}`,
      awayTeamId: `af-team-${f.teams.away.id}`,
      homeTeam: { id: `af-team-${f.teams.home.id}`, name: f.teams.home.name, shortName: f.teams.home.code, league },
      awayTeam: { id: `af-team-${f.teams.away.id}`, name: f.teams.away.name, shortName: f.teams.away.code, league },
      kickoff: f.fixture.date,
      league,
      venue: "",
      status: this.mapStatus(f.fixture.status.short),
      homeScore: f.goals.home ?? undefined,
      awayScore: f.goals.away ?? undefined,
    };
  }

  async fetchTeam(teamId: string): Promise<Team> {
    const id = teamId.replace("af-team-", "");
    const data = await fetchJson<{ response: AFTeam[] }>(
      `https://v3.football.api-sports.io/teams?id=${id}`,
      this.headers,
      API_FOOTBALL_LIMITER,
    );
    const t = data.response[0];
    if (!t) throw new Error(`Team ${teamId} not found`);
    return {
      id: `af-team-${t.team.id}`,
      name: t.team.name,
      shortName: t.team.code,
      league: "",
      crest: t.team.logo,
    };
  }

  async fetchSquad(teamId: string): Promise<Player[]> {
    const id = teamId.replace("af-team-", "");
    const data = await fetchJson<{
      response: { players: { id: number; name: string; age: number; nationality: string; position: string }[] }[];
    }>(
      `https://v3.football.api-sports.io/players/squads?team=${id}`,
      this.headers,
      API_FOOTBALL_LIMITER,
    );
    const squad = data.response[0]?.players || [];
    return squad.map((p) => ({
      id: `af-player-${p.id}`,
      teamId,
      name: p.name,
      number: 0,
      position: p.position as Player["position"],
      age: p.age,
      nationality: p.nationality,
    }));
  }
}

// ─── StatsBomb (placeholder) ────────────────────────────────────────

export class StatsBombProvider extends BaseAdapter {
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

// ─── Sportmonks (placeholder) ───────────────────────────────────────

export class SportmonksProvider extends BaseAdapter {
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
