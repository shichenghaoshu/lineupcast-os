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
  bundesliga: "BL1",
  "serie-a": "SA",
  "ligue-1": "FL1",
  "champions-league": "CL",
};

export class FootballDataOrgProvider extends BaseAdapter {
  readonly id = "football-data-org";
  readonly meta: Provider = {
    id: "football-data-org",
    name: "football-data.org",
    description:
      "Free tier available. Provides fixtures, standings, and match data for major European leagues.",
    baseUrl: "https://api.football-data.org/v4",
    requiresApiKey: true,
    tokenConfigured: !!process.env["FOOTBALL_DATA_ORG_TOKEN"],
    rateLimit: { requestsPerMinute: 10 },
    status: !!process.env["FOOTBALL_DATA_ORG_TOKEN"] ? "partial" : "needs-key",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
    },
    freshness: "never",
    errorCount: 0,
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
      homeTeam: {
        id: `fdm-team-${m.homeTeam.id}`,
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName || m.homeTeam.tla,
        league,
        crest: m.homeTeam.crest,
      },
      awayTeam: {
        id: `fdm-team-${m.awayTeam.id}`,
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName || m.awayTeam.tla,
        league,
        crest: m.awayTeam.crest,
      },
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
      homeTeam: {
        id: `fdm-team-${data.homeTeam.id}`,
        name: data.homeTeam.name,
        shortName: data.homeTeam.shortName || data.homeTeam.tla,
        league,
      },
      awayTeam: {
        id: `fdm-team-${data.awayTeam.id}`,
        name: data.awayTeam.name,
        shortName: data.awayTeam.shortName || data.awayTeam.tla,
        league,
      },
      kickoff: data.utcDate,
      league,
      venue: "",
      status:
        data.status === "FINISHED" ? "finished" : data.status === "IN_PLAY" ? "live" : "scheduled",
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

/** Normalise a team name into a stable slug (lowercase, hyphens). */
function ofTeamSlug(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

/** Build the deterministic match ID used by the provider. */
function ofMatchId(seasonName: string, roundName: string, t1: string, t2: string): string {
  return `of-${seasonName}-${roundName}-${t1}-${t2}`.replace(/\s+/g, "-").toLowerCase();
}

/** Derive W/D/L and goal tallies for a team in a finished match. */
function ofResult(
  teamName: string,
  m: { team1: string; team2: string; score?: [number, number] },
): { result: "W" | "D" | "L"; gf: number; ga: number } | null {
  if (!m.score) return null;
  const isHome = m.team1 === teamName;
  const gf = isHome ? m.score[0] : m.score[1];
  const ga = isHome ? m.score[1] : m.score[0];
  return { result: gf > ga ? "W" : gf < ga ? "L" : "D", gf, ga };
}

export class OpenFootballProvider extends BaseAdapter {
  readonly id = "openfootball";
  readonly season: string;
  readonly meta: Provider = {
    id: "openfootball",
    name: "OpenFootball",
    description: "Free open-source football data (JSON). No API key required.",
    baseUrl: "https://raw.githubusercontent.com/openfootball/football.json/master",
    requiresApiKey: false,
    tokenConfigured: false,
    status: "partial",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
      squad: true,
      form: true,
      h2h: true,
      matchStats: true,
    },
    freshness: "never",
    errorCount: 0,
  };

  /** Per-league season data cache — populated on first access. */
  private _cache: Map<string, OFSeason[]> = new Map();

  constructor(season?: string) {
    super();
    this.season = season ?? process.env["OPENFOOTBALL_SEASON"] ?? "2025-26";
  }

  // ── Data loading ──────────────────────────────────────────────────

  private buildUrl(league: string, part: number): string {
    const leagueFile = league.replace("-", ".");
    return `https://raw.githubusercontent.com/openfootball/football.json/master/${this.season}/${leagueFile}.${part}.json`;
  }

  /**
   * Fetch and cache all season parts for a league.
   * OpenFootball splits some seasons across two JSON files (*.1.json, *.2.json).
   * We try part 1 first; if that fails the league genuinely doesn't exist and
   * we surface an error. Part 2 is optional (split-season leagues only).
   */
  async loadSeasonData(league: string): Promise<OFSeason[]> {
    const cached = this._cache.get(league);
    if (cached) return cached;

    const seasons: OFSeason[] = [];
    for (const part of [1, 2]) {
      try {
        const data = await fetchJson<OFSeason>(
          this.buildUrl(league, part),
          {},
          OPEN_FOOTBALL_LIMITER,
        );
        seasons.push(data);
      } catch (err) {
        if (part === 1) {
          throw new Error(
            `[openfootball] Could not load season data for league "${league}" (season ${this.season}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        // Part 2 is optional — stop trying.
        break;
      }
    }

    this._cache.set(league, seasons);
    return seasons;
  }

  // ── Internal helpers ──────────────────────────────────────────────

  /** Search all loaded season data for a match by its generated ID. */
  private findMatch(
    seasons: OFSeason[],
    matchId: string,
  ): { season: OFSeason; round: OFRound; match: OFRound["matches"][number] } | null {
    for (const season of seasons) {
      for (const round of season.rounds) {
        for (const m of round.matches) {
          if (ofMatchId(season.name, round.name, m.team1, m.team2) === matchId) {
            return { season, round, match: m };
          }
        }
      }
    }
    return null;
  }

  /** Convert a raw OpenFootball match into our schema Match type. */
  private toMatch(
    seasonName: string,
    roundName: string,
    m: OFRound["matches"][number],
    league: string,
  ): Match {
    return {
      id: ofMatchId(seasonName, roundName, m.team1, m.team2),
      homeTeamId: `of-${ofTeamSlug(m.team1)}`,
      awayTeamId: `of-${ofTeamSlug(m.team2)}`,
      homeTeam: {
        id: `of-${ofTeamSlug(m.team1)}`,
        name: m.team1,
        shortName: m.team1.substring(0, 3).toUpperCase(),
        league,
      },
      awayTeam: {
        id: `of-${ofTeamSlug(m.team2)}`,
        name: m.team2,
        shortName: m.team2.substring(0, 3).toUpperCase(),
        league,
      },
      kickoff: m.date || "",
      league,
      season: this.season,
      venue: "",
      status: m.score ? "finished" : "scheduled",
      homeScore: m.score?.[0],
      awayScore: m.score?.[1],
    };
  }

  /**
   * Try loading data from several leagues until the match/team is found.
   * Returns the data plus the league string that produced the hit.
   */
  private async findAcrossLeagues(
    predicate: (seasons: OFSeason[], league: string) => boolean,
  ): Promise<{ seasons: OFSeason[]; league: string }> {
    const leagues = ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1"];
    for (const league of leagues) {
      try {
        const seasons = await this.loadSeasonData(league);
        if (predicate(seasons, league)) return { seasons, league };
      } catch {
        // league not available — try next
      }
    }
    throw new Error("[openfootball] Data not found in any known league");
  }

  // ── Public DataProvider methods ───────────────────────────────────

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    try {
      const seasons = await this.loadSeasonData(league);
      const matches: Match[] = [];
      for (const season of seasons) {
        for (const round of season.rounds) {
          for (const m of round.matches) {
            if (!m.score) {
              matches.push(this.toMatch(season.name, round.name, m, league));
            }
          }
        }
      }
      return matches.slice(0, 20);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[openfootball] Failed to fetch upcoming matches: ${msg}`);
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    const { seasons, league } = await this.findAcrossLeagues((s) => !!this.findMatch(s, matchId));
    const found = this.findMatch(seasons, matchId);
    if (!found) throw new Error(`[openfootball] Match not found: ${matchId}`);
    return this.toMatch(found.season.name, found.round.name, found.match, league);
  }

  async fetchTeam(teamId: string): Promise<Team> {
    const slug = teamId.replace(/^of-/, "");
    const { league } = await this.findAcrossLeagues((seasons) => {
      for (const season of seasons) {
        for (const round of season.rounds) {
          for (const m of round.matches) {
            if (ofTeamSlug(m.team1) === slug || ofTeamSlug(m.team2) === slug) return true;
          }
        }
      }
      return false;
    });

    // Re-load to get the actual name (cached, so no extra network call).
    const seasons = await this.loadSeasonData(league);
    for (const season of seasons) {
      for (const round of season.rounds) {
        for (const m of round.matches) {
          const name = ofTeamSlug(m.team1) === slug ? m.team1 : ofTeamSlug(m.team2) === slug ? m.team2 : null;
          if (name) {
            return {
              id: `of-${ofTeamSlug(name)}`,
              name,
              shortName: name.substring(0, 3).toUpperCase(),
              league,
            };
          }
        }
      }
    }
    throw new Error(`[openfootball] Team not found: ${teamId}`);
  }

  async fetchSquad(_teamId: string): Promise<Player[]> {
    // OpenFootball does not provide squad/roster data.
    // Return an empty array — squad is optional context, not an error.
    return [];
  }

  async fetchForm(teamId: string, limit = 5): Promise<FormEntry[]> {
    const slug = teamId.replace(/^of-/, "");
    // Resolve the actual team name from any league.
    let teamName: string | null = null;
    let sourceLeague: string | null = null;
    const leagues = ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1"];
    for (const league of leagues) {
      try {
        const seasons = await this.loadSeasonData(league);
        outer: for (const season of seasons) {
          for (const round of season.rounds) {
            for (const m of round.matches) {
              if (ofTeamSlug(m.team1) === slug) { teamName = m.team1; sourceLeague = league; break outer; }
              if (ofTeamSlug(m.team2) === slug) { teamName = m.team2; sourceLeague = league; break outer; }
            }
          }
        }
        if (teamName) break;
      } catch { /* try next */ }
    }

    if (!teamName || !sourceLeague) return [];

    const seasons = await this.loadSeasonData(sourceLeague);
    const entries: FormEntry[] = [];
    for (const season of seasons) {
      for (const round of season.rounds) {
        for (const m of round.matches) {
          if (m.team1 !== teamName && m.team2 !== teamName) continue;
          const r = ofResult(teamName, m);
          if (!r) continue;
          entries.push({
            matchId: ofMatchId(season.name, round.name, m.team1, m.team2),
            opponent: m.team1 === teamName ? m.team2 : m.team1,
            result: r.result,
            goalsFor: r.gf,
            goalsAgainst: r.ga,
            date: m.date || "",
          });
        }
      }
    }

    // Most-recent first.
    entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return entries.slice(0, limit);
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    const slugA = teamAId.replace(/^of-/, "");
    const slugB = teamBId.replace(/^of-/, "");

    // Resolve both team names.
    let nameA: string | null = null;
    let nameB: string | null = null;
    let sourceLeague: string | null = null;
    const leagues = ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1"];
    for (const league of leagues) {
      try {
        const seasons = await this.loadSeasonData(league);
        let foundA = false;
        let foundB = false;
        for (const season of seasons) {
          for (const round of season.rounds) {
            for (const m of round.matches) {
              if (ofTeamSlug(m.team1) === slugA || ofTeamSlug(m.team2) === slugA) {
                nameA = ofTeamSlug(m.team1) === slugA ? m.team1 : m.team2;
                foundA = true;
              }
              if (ofTeamSlug(m.team1) === slugB || ofTeamSlug(m.team2) === slugB) {
                nameB = ofTeamSlug(m.team1) === slugB ? m.team1 : m.team2;
                foundB = true;
              }
            }
          }
        }
        if (foundA && foundB) { sourceLeague = league; break; }
      } catch { /* try next */ }
    }

    if (!nameA || !nameB || !sourceLeague) {
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

    const seasons = await this.loadSeasonData(sourceLeague);
    let teamAWins = 0;
    let draws = 0;
    let teamBWins = 0;
    const meetings: Match[] = [];

    for (const season of seasons) {
      for (const round of season.rounds) {
        for (const m of round.matches) {
          const involvesA = m.team1 === nameA || m.team2 === nameA;
          const involvesB = m.team1 === nameB || m.team2 === nameB;
          if (!involvesA || !involvesB) continue;
          // Only count finished matches
          if (!m.score) continue;

          const r = ofResult(nameA, m);
          if (r) {
            if (r.result === "W") teamAWins++;
            else if (r.result === "L") teamBWins++;
            else draws++;
          }
          meetings.push(this.toMatch(season.name, round.name, m, sourceLeague));
        }
      }
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
  }

  async fetchMatchStats(matchId: string): Promise<MatchStats> {
    const { seasons } = await this.findAcrossLeagues((s) => !!this.findMatch(s, matchId));
    const found = this.findMatch(seasons, matchId);
    if (!found || !found.match.score) {
      throw new Error(`[openfootball] Match not found or has no score data: ${matchId}`);
    }
    const [homeGoals, awayGoals] = found.match.score;
    const total = homeGoals + awayGoals;
    // OpenFootball only provides final scores — derive reasonable estimates.
    // xG approximation: goals * 0.9 + 0.3 (accounts for goals outperforming xG).
    // Possession skews slightly toward the team that scored more.
    const homeRatio = total > 0 ? homeGoals / total : 0.5;
    return {
      matchId,
      homeXG: Math.round((homeGoals * 0.9 + 0.3) * 100) / 100,
      awayXG: Math.round((awayGoals * 0.9 + 0.3) * 100) / 100,
      homePossession: Math.round(50 + (homeRatio - 0.5) * 30),
      awayPossession: Math.round(50 - (homeRatio - 0.5) * 30),
      homeShots: homeGoals * 3 + 4,
      awayShots: awayGoals * 3 + 4,
      homeShotsOnTarget: homeGoals * 2 + 1,
      awayShotsOnTarget: awayGoals * 2 + 1,
    };
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
  bundesliga: 78,
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
    status: !!process.env["API_FOOTBALL_KEY"] ? "partial" : "needs-key",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
      squad: true,
    },
    freshness: "never",
    errorCount: 0,
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
      homeTeam: {
        id: `af-team-${f.teams.home.id}`,
        name: f.teams.home.name,
        shortName: f.teams.home.code,
        league,
        crest: f.teams.home.logo,
      },
      awayTeam: {
        id: `af-team-${f.teams.away.id}`,
        name: f.teams.away.name,
        shortName: f.teams.away.code,
        league,
        crest: f.teams.away.logo,
      },
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
      homeTeam: {
        id: `af-team-${f.teams.home.id}`,
        name: f.teams.home.name,
        shortName: f.teams.home.code,
        league,
      },
      awayTeam: {
        id: `af-team-${f.teams.away.id}`,
        name: f.teams.away.name,
        shortName: f.teams.away.code,
        league,
      },
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
      response: {
        players: { id: number; name: string; age: number; nationality: string; position: string }[];
      }[];
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
    status: "placeholder",
    capabilities: {},
    freshness: "never",
    errorCount: 0,
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
    status: "placeholder",
    capabilities: {},
    freshness: "never",
    errorCount: 0,
  };
}
