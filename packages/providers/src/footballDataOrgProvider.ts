// @lineupcast/providers — Standalone football-data.org provider
//
// Implements the DataProvider interface against the football-data.org v4 API.
// Designed as a self-contained module separate from adapters.ts.

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
import { RateLimiter, FOOTBALL_DATA_ORG_LIMITER } from "./rate-limiter.js";

// ─── Configuration ──────────────────────────────────────────────────────

export interface FootballDataOrgConfig {
  /** API key from FOOTBALL_DATA_API_KEY env var. */
  apiKey: string;
  /** Base URL from FOOTBALL_DATA_BASE_URL env var, defaults to v4. */
  baseUrl: string;
}

/** Health/status returned by the provider's status check. */
export type FootballDataOrgHealthStatus =
  | "healthy"
  | "missing_token"
  | "rate_limited"
  | "degraded"
  | "offline";

/** Health report from the provider. */
export interface FootballDataOrgHealth {
  status: FootballDataOrgHealthStatus;
  message?: string;
}

/** Detailed health check result from runHealthCheck(). */
export interface HealthCheckResult {
  status: FootballDataOrgHealthStatus;
  tokenValid: boolean;
  rateLimited: boolean;
  latencyMs: number;
  timestamp: string;
  message?: string;
}

// ─── League code mapping ────────────────────────────────────────────────

const LEAGUE_CODES: Record<string, string> = {
  "premier-league": "PL",
  "la-liga": "PD",
  bundesliga: "BL1",
  "serie-a": "SA",
  "ligue-1": "FL1",
  "champions-league": "CL",
};

// ─── API response types ─────────────────────────────────────────────────

interface FDOTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address?: string;
  website?: string;
  founded?: number;
  venue?: string;
  squad?: FDOPlayer[];
  runningCompetitions?: { id: number; name: string; code: string }[];
}

interface FDOPlayer {
  id: number;
  name: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
  shirtNumber?: number;
  role?: string;
}

interface FDOMatch {
  id: number;
  competition: { id: number; name: string; code: string; emblem?: string };
  utcDate: string;
  status: string;
  matchday?: number;
  stage?: string;
  homeTeam: FDOTeam & { score?: number | null };
  awayTeam: FDOTeam & { score?: number | null };
  referees?: { name: string; type: string }[];
}

interface FDOMatchResponse {
  matches: FDOMatch[];
  resultSet?: {
    count: number;
    competitions: string;
    first: string;
    last: string;
    played: number;
  };
}

interface FDOTeamResponse {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address?: string;
  website?: string;
  founded?: number;
  venue?: string;
  runningCompetitions?: { id: number; name: string; code: string }[];
  coach?: { name: string; nationality?: string };
  squad?: FDOPlayer[];
}

interface FDOStandingsResponse {
  standings: {
    type: string;
    table: {
      position: number;
      team: { id: number; name: string; crest: string };
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      form?: string;
    }[];
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Safely read an env var, returning undefined when missing. */
function getEnv(name: string): string | undefined {
  return process.env[name];
}

/** Map football-data.org match status strings to our MatchStatus. */
function mapMatchStatus(
  apiStatus: string,
): "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "abandoned" {
  switch (apiStatus) {
    case "FINISHED":
      return "finished";
    case "IN_PLAY":
    case "PAUSED":
    case "HALFTIME":
      return "live";
    case "POSTPONED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    case "SUSPENDED":
      return "abandoned";
    default:
      return "scheduled";
  }
}

/** Convert an API team object into our Team schema. */
function toTeam(team: FDOTeam, league?: string): Team {
  return {
    id: `fdm-team-${team.id}`,
    name: team.name,
    shortName: team.shortName || team.tla,
    league: league ?? "",
    crest: team.crest,
    founded: team.founded,
    venue: team.venue,
  };
}

/** Convert an API match object into our Match schema. */
function toMatch(m: FDOMatch): Match {
  const league = m.competition.code;
  return {
    id: `fdm-${m.id}`,
    homeTeamId: `fdm-team-${m.homeTeam.id}`,
    awayTeamId: `fdm-team-${m.awayTeam.id}`,
    homeTeam: toTeam(m.homeTeam, league),
    awayTeam: toTeam(m.awayTeam, league),
    kickoff: m.utcDate,
    league,
    matchday: m.matchday,
    venue: "",
    referee: m.referees?.[0]?.name,
    status: mapMatchStatus(m.status),
    homeScore: m.homeTeam.score ?? undefined,
    awayScore: m.awayTeam.score ?? undefined,
  };
}

// ─── Standings entry type (exported for consumers) ──────────────────────

export interface StandingsEntry {
  position: number;
  teamId: string;
  teamName: string;
  crest: string;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string;
}

// ─── Schema validation ─────────────────────────────────────────────────

/** Validate that a response has the expected shape. Returns true if valid. */
function isValidMatchResponse(data: unknown): data is FDOMatchResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "matches" in data &&
    Array.isArray((data as FDOMatchResponse).matches)
  );
}

function isValidMatch(data: unknown): data is FDOMatch {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "homeTeam" in data &&
    "awayTeam" in data &&
    "status" in data
  );
}

function isValidTeam(data: unknown): data is FDOTeamResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data
  );
}

function isValidStandings(data: unknown): data is FDOStandingsResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "standings" in data &&
    Array.isArray((data as FDOStandingsResponse).standings)
  );
}

// ─── Provider implementation ────────────────────────────────────────────

/**
 * Standalone football-data.org provider.
 *
 * Reads configuration from environment:
 *   FOOTBALL_DATA_API_KEY  — the API token (required)
 *   FOOTBALL_DATA_BASE_URL — override base URL (optional, defaults to v4)
 *
 * All public methods are wrapped so provider failures never crash the page;
 * callers receive degraded / empty data instead.
 */
export class FootballDataOrgProvider implements DataProvider {
  readonly id = "football-data-org-v2";
  readonly meta: Provider;

  private readonly config: FootballDataOrgConfig;
  private readonly limiter: RateLimiter;
  private healthStatus: FootballDataOrgHealthStatus = "missing_token";

  constructor(
    config?: Partial<FootballDataOrgConfig>,
    limiter?: RateLimiter,
  ) {
    const apiKey = config?.apiKey ?? getEnv("FOOTBALL_DATA_API_KEY") ?? "";
    const baseUrl =
      config?.baseUrl ??
      getEnv("FOOTBALL_DATA_BASE_URL") ??
      "https://api.football-data.org/v4";

    this.config = { apiKey, baseUrl };
    this.limiter = limiter ?? FOOTBALL_DATA_ORG_LIMITER;

    // Derive initial health from token presence.
    this.healthStatus = apiKey ? "healthy" : "missing_token";

    this.meta = {
      id: this.id,
      name: "football-data.org (standalone)",
      description:
        "Standalone adapter for football-data.org v4 API. Provides fixtures, match details, teams, squads, recent form, standings, and lineups (may be empty pre-match).",
      baseUrl,
      requiresApiKey: true,
      tokenConfigured: !!apiKey,
      rateLimit: { requestsPerMinute: 10 },
      status: apiKey ? "full" : "needs-key",
      capabilities: {
        upcomingMatches: true,
        match: true,
        team: true,
        squad: true,
        form: true,
        h2h: true,
        standings: true,
        lineup: true,
      },
      freshness: "never",
      errorCount: 0,
    };
  }

  // ── Health / status ──────────────────────────────────────────────────

  /** Return the current health status of the provider. */
  getHealth(): FootballDataOrgHealth {
    switch (this.healthStatus) {
      case "missing_token":
        return {
          status: "missing_token",
          message: "FOOTBALL_DATA_API_KEY is not configured.",
        };
      case "rate_limited":
        return {
          status: "rate_limited",
          message: "Rate limit exceeded (HTTP 429).",
        };
      case "degraded":
        return {
          status: "degraded",
          message: "Upstream API returned a server error (5xx).",
        };
      case "offline":
        return {
          status: "offline",
          message: "API is unreachable. Check network connectivity.",
        };
      case "healthy":
      default:
        return { status: "healthy" };
    }
  }

  /**
   * Run a comprehensive health check against the API.
   * Tests connectivity, token validity, rate limit status, and measures latency.
   * Never exposes the API key in responses.
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    if (!this.config.apiKey) {
      return {
        status: "missing_token",
        tokenValid: false,
        rateLimited: false,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        message: "FOOTBALL_DATA_API_KEY is not configured.",
      };
    }

    if (!this.limiter.tryAcquire()) {
      return {
        status: "rate_limited",
        tokenValid: true,
        rateLimited: true,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        message: "Local rate limit exhausted.",
      };
    }

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${this.config.baseUrl}/competitions/PL/matches?limit=1`, {
        headers: this.headers,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;

      if (res.status === 401 || res.status === 403) {
        this.healthStatus = "missing_token";
        return {
          status: "missing_token",
          tokenValid: false,
          rateLimited: false,
          latencyMs,
          timestamp: new Date().toISOString(),
          message: "API key is invalid or unauthorized.",
        };
      }

      if (res.status === 429) {
        this.healthStatus = "rate_limited";
        return {
          status: "rate_limited",
          tokenValid: true,
          rateLimited: true,
          latencyMs,
          timestamp: new Date().toISOString(),
          message: "Rate limit exceeded (HTTP 429).",
        };
      }

      if (res.status >= 500) {
        this.healthStatus = "degraded";
        return {
          status: "degraded",
          tokenValid: true,
          rateLimited: false,
          latencyMs,
          timestamp: new Date().toISOString(),
          message: `Server error: HTTP ${res.status}.`,
        };
      }

      if (!res.ok) {
        return {
          status: "healthy",
          tokenValid: true,
          rateLimited: false,
          latencyMs,
          timestamp: new Date().toISOString(),
          message: `Unexpected status: HTTP ${res.status}.`,
        };
      }

      this.healthStatus = "healthy";
      return {
        status: "healthy",
        tokenValid: true,
        rateLimited: false,
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.healthStatus = "offline";
      return {
        status: "offline",
        tokenValid: true,
        rateLimited: false,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        message: "API unreachable. Check network connectivity.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Low-level fetch ──────────────────────────────────────────────────

  private get headers(): Record<string, string> {
    return { "X-Auth-Token": this.config.apiKey };
  }

  /**
   * Perform a rate-limited, timeout-bounded fetch against the football-data.org API.
   * Updates healthStatus on failure; never throws to callers.
   */
  private async apiFetch<T>(path: string): Promise<T | null> {
    if (!this.config.apiKey) {
      this.healthStatus = "missing_token";
      return null;
    }

    if (!this.limiter.tryAcquire()) {
      this.healthStatus = "rate_limited";
      return null;
    }

    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        headers: this.headers,
        signal: controller.signal,
      });

      if (res.status === 429) {
        this.healthStatus = "rate_limited";
        return null;
      }

      if (res.status >= 500) {
        this.healthStatus = "degraded";
        return null;
      }

      if (!res.ok) {
        // 4xx (other than 429) — not a provider health issue, just a bad request.
        this.healthStatus = "healthy";
        return null;
      }

      this.healthStatus = "healthy";
      return (await res.json()) as T;
    } catch (err) {
      // Network error or abort — distinguish offline from server error.
      if (err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError")) {
        this.healthStatus = "offline";
      } else {
        this.healthStatus = "degraded";
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Standalone endpoint methods ──────────────────────────────────────

  /**
   * GET /competitions/{code}/matches
   *
   * Fetches matches for a competition/league. The `league` parameter accepts
   * either a slug (e.g. "premier-league") or a raw code (e.g. "PL").
   *
   * Returns matches filtered by the optional `status` query (default: no filter).
   */
  async getFixtures(
    league: string,
    status?: string,
    limit?: number,
  ): Promise<Match[]> {
    const code = LEAGUE_CODES[league] ?? league.toUpperCase();
    let path = `/competitions/${code}/matches`;
    const params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length) path += `?${params.join("&")}`;

    const data = await this.apiFetch<unknown>(path);
    if (!data) return [];
    if (!isValidMatchResponse(data)) {
      this.healthStatus = "degraded";
      return [];
    }
    return data.matches.map(toMatch);
  }

  /**
   * GET /matches/{id}
   *
   * Fetches a single match by its football-data.org numeric ID.
   * Accepts either the raw numeric ID or our prefixed "fdm-{id}" format.
   */
  async getMatch(matchId: string): Promise<Match | null> {
    const id = matchId.replace(/^fdm-/, "");
    const data = await this.apiFetch<unknown>(`/matches/${id}`);
    if (!data) return null;
    if (!isValidMatch(data)) {
      this.healthStatus = "degraded";
      return null;
    }
    return toMatch(data);
  }

  /**
   * GET /teams/{id}/matches?status=FINISHED&limit=5
   *
   * Fetches the most recent finished matches for a team.
   */
  async getRecentMatches(teamId: string, limit = 5): Promise<Match[]> {
    const id = teamId.replace(/^fdm-team-/, "");
    const data = await this.apiFetch<unknown>(
      `/teams/${id}/matches?status=FINISHED&limit=${limit}`,
    );
    if (!data) return [];
    if (!isValidMatchResponse(data)) {
      this.healthStatus = "degraded";
      return [];
    }
    return data.matches.map(toMatch);
  }

  /**
   * GET /teams/{id}
   *
   * Fetches basic team info (and squad if available in the response).
   */
  async getSquad(teamId: string): Promise<Player[]> {
    const id = teamId.replace(/^fdm-team-/, "");
    const data = await this.apiFetch<unknown>(`/teams/${id}`);
    if (!data) return [];
    if (!isValidTeam(data)) {
      this.healthStatus = "degraded";
      return [];
    }
    if (!data.squad) return [];

    return data.squad.map((p) => ({
      id: `fdm-player-${p.id}`,
      teamId: `fdm-team-${id}`,
      name: p.name,
      position: (p.position ?? "CF") as Player["position"],
      shirtNumber: p.shirtNumber,
      nationality: p.nationality,
      dateOfBirth: p.dateOfBirth,
      role: p.role,
    }));
  }

  /**
   * Fetch standings for a competition.
   *
   * Uses GET /competitions/{code}/standings under the hood.
   */
  async getStandings(league: string): Promise<StandingsEntry[]> {
    const code = LEAGUE_CODES[league] ?? league.toUpperCase();
    const data = await this.apiFetch<unknown>(
      `/competitions/${code}/standings`,
    );
    if (!data) return [];
    if (!isValidStandings(data)) {
      this.healthStatus = "degraded";
      return [];
    }

    // Find the "TOTAL" type standings (the main table).
    const totalTable = data.standings.find((s) => s.type === "TOTAL");
    if (!totalTable) return [];

    return totalTable.table.map((row) => ({
      position: row.position,
      teamId: `fdm-team-${row.team.id}`,
      teamName: row.team.name,
      crest: row.team.crest,
      playedGames: row.playedGames,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      form: row.form,
    }));
  }

  // ── DataProvider interface implementation ────────────────────────────
  //
  // These methods bridge the generic DataProvider contract to the
  // standalone endpoint methods above. Errors are caught and degraded
  // status is set — the page should never crash.

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    try {
      return await this.getFixtures(league, "SCHEDULED");
    } catch {
      this.healthStatus = "degraded";
      return [];
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        // Return a minimal placeholder match so callers never crash.
        return {
          id: matchId,
          homeTeamId: "",
          awayTeamId: "",
          homeTeam: { id: "", name: "Unknown", shortName: "?", league: "", crest: "" },
          awayTeam: { id: "", name: "Unknown", shortName: "?", league: "", crest: "" },
          kickoff: "",
          league: "",
          status: "scheduled",
        };
      }
      return match;
    } catch {
      this.healthStatus = "degraded";
      return {
        id: matchId,
        homeTeamId: "",
        awayTeamId: "",
        homeTeam: { id: "", name: "Unknown", shortName: "?", league: "", crest: "" },
        awayTeam: { id: "", name: "Unknown", shortName: "?", league: "", crest: "" },
        kickoff: "",
        league: "",
        status: "scheduled",
      };
    }
  }

  async fetchTeam(teamId: string): Promise<Team> {
    try {
      const id = teamId.replace(/^fdm-team-/, "");
      const data = await this.apiFetch<unknown>(`/teams/${id}`);
      if (!data || !isValidTeam(data)) {
        if (data) this.healthStatus = "degraded";
        return {
          id: teamId,
          name: "Unknown",
          shortName: "?",
          league: "",
          crest: "",
        };
      }
      return toTeam(data);
    } catch {
      this.healthStatus = "degraded";
      return {
        id: teamId,
        name: "Unknown",
        shortName: "?",
        league: "",
        crest: "",
      };
    }
  }

  async fetchSquad(teamId: string): Promise<Player[]> {
    try {
      return await this.getSquad(teamId);
    } catch {
      this.healthStatus = "degraded";
      return [];
    }
  }

  async fetchLineup(_matchId: string, _teamId: string): Promise<Lineup> {
    // football-data.org does not provide pre-match lineup data via free tier.
    // Return empty/default — lineups may be populated post-match in some tiers.
    try {
      return {
        matchId: _matchId,
        teamId: _teamId,
        formation: "",
        starters: [],
        substitutes: [],
      };
    } catch {
      this.healthStatus = "degraded";
      return {
        matchId: _matchId,
        teamId: _teamId,
        formation: "",
        starters: [],
        substitutes: [],
      };
    }
  }

  async fetchMatchStats(_matchId: string): Promise<MatchStats> {
    // Not available from football-data.org free tier.
    return {
      matchId: _matchId,
      homeXG: 0,
      awayXG: 0,
      homePossession: 0,
      awayPossession: 0,
      homeShots: 0,
      awayShots: 0,
    };
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    // football-data.org does not provide a direct H2H endpoint on the free tier.
    // Derive H2H from recent matches of team A (best-effort).
    try {
      const recentA = await this.getRecentMatches(teamAId, 20);
      const idA = teamAId.replace(/^fdm-team-/, "");
      const idB = teamBId.replace(/^fdm-team-/, "");

      const meetings = recentA.filter((m) => {
        const homeId = m.homeTeamId.replace(/^fdm-team-/, "");
        const awayId = m.awayTeamId.replace(/^fdm-team-/, "");
        return (
          (homeId === idA && awayId === idB) ||
          (homeId === idB && awayId === idA)
        );
      });

      let teamAWins = 0;
      let draws = 0;
      let teamBWins = 0;

      for (const m of meetings) {
        if (m.status !== "finished" || m.homeScore == null || m.awayScore == null) continue;
        const isHomeA = m.homeTeamId.replace(/^fdm-team-/, "") === idA;
        const aGoals = isHomeA ? m.homeScore : m.awayScore;
        const bGoals = isHomeA ? m.awayScore : m.homeScore;
        if (aGoals > bGoals) teamAWins++;
        else if (aGoals < bGoals) teamBWins++;
        else draws++;
      }

      return {
        teamAId,
        teamBId,
        totalMatches: meetings.length,
        teamAWins,
        draws,
        teamBWins,
        lastMeetings: meetings.slice(0, 5),
      };
    } catch {
      this.healthStatus = "degraded";
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
  }

  async fetchForm(teamId: string, limit = 5): Promise<FormEntry[]> {
    try {
      const matches = await this.getRecentMatches(teamId, limit);
      const id = teamId.replace(/^fdm-team-/, "");

      return matches
        .filter((m) => m.status === "finished" && m.homeScore != null && m.awayScore != null)
        .map((m) => {
          const isHome = m.homeTeamId.replace(/^fdm-team-/, "") === id;
          const gf = isHome ? m.homeScore! : m.awayScore!;
          const ga = isHome ? m.awayScore! : m.homeScore!;
          return {
            matchId: m.id,
            opponent: isHome ? m.awayTeam?.name ?? "" : m.homeTeam?.name ?? "",
            result: (gf > ga ? "W" : gf < ga ? "L" : "D") as "W" | "D" | "L",
            goalsFor: gf,
            goalsAgainst: ga,
            date: m.kickoff,
          };
        });
    } catch {
      this.healthStatus = "degraded";
      return [];
    }
  }

  async fetchPrediction(_matchId: string): Promise<Prediction> {
    // football-data.org does not provide prediction data.
    return {
      matchId: _matchId,
      homeWin: 0,
      draw: 0,
      awayWin: 0,
      expectedHomeGoals: 0,
      expectedAwayGoals: 0,
      confidence: "low",
    };
  }
}
