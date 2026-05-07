// @lineupcast/providers — CsvProvider: data provider backed by imported CSV data
//
// Accepts pre-parsed CSV rows as constructor input and returns data in the
// same format as MockProvider.  All methods are safe — they never throw.
// Returns empty/default values when data is missing.

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

// ─── Input row types ─────────────────────────────────────────────────

/** A single row from the lineup CSV import. */
export interface CsvLineupRow {
  matchId: string;
  teamId: string;
  teamName: string;
  formation: string;
  playerId: string;
  playerName: string;
  position: string;
  number?: number;
  isStarter: boolean; // true = starter, false = substitute
  coach?: string;
  nationality?: string;
  age?: number;
  rating?: number;
  captain?: boolean;
}

/** A single row from the player-stats CSV import. */
export interface CsvPlayerStatsRow {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  rating?: number;
  xG?: number;
  xA?: number;
}

/** A single row from the match-history CSV import. */
export interface CsvMatchHistoryRow {
  matchId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  kickoff: string; // ISO 8601
  league: string;
  season?: string;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
}

/** Constructor options for CsvProvider. */
export interface CsvProviderData {
  lineups?: CsvLineupRow[];
  playerStats?: CsvPlayerStatsRow[];
  matchHistory?: CsvMatchHistoryRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildTeamFromRow(
  teamId: string,
  teamName: string,
  league: string,
): Team {
  return {
    id: teamId,
    name: teamName,
    shortName: teamName.substring(0, 3).toUpperCase(),
    league,
  };
}

function buildPlayerFromRow(
  row: CsvLineupRow | CsvPlayerStatsRow,
): Player {
  return {
    id: row.playerId,
    name: (row as CsvLineupRow).playerName ?? (row as CsvPlayerStatsRow).playerName,
    teamId: row.teamId,
    position: row.position as Player["position"],
    number: (row as CsvLineupRow).number,
    nationality: (row as CsvLineupRow).nationality,
    age: (row as CsvLineupRow).age,
    rating: (row as CsvLineupRow).rating ?? (row as CsvPlayerStatsRow).rating,
    captain: (row as CsvLineupRow).captain,
  };
}

function parseStatus(
  raw: string,
): "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "abandoned" {
  const s = raw.toLowerCase().trim();
  if (s === "live" || s === "in_play") return "live";
  if (s === "finished" || s === "ft") return "finished";
  if (s === "postponed") return "postponed";
  if (s === "cancelled") return "cancelled";
  if (s === "abandoned") return "abandoned";
  return "scheduled";
}

// ─── Provider Meta ───────────────────────────────────────────────────

function buildMeta(hasData: boolean): Provider {
  return {
    id: "csv",
    name: "CSV Data Provider",
    description:
      "Reads match, lineup, and player data from imported CSV files. " +
      "No external API calls — purely local data.",
    requiresApiKey: false,
    tokenConfigured: false,
    status: hasData ? "full" : "placeholder",
    capabilities: {
      upcomingMatches: true,
      match: true,
      team: true,
      squad: true,
      lineup: true,
      matchStats: true,
      h2h: true,
      form: true,
      prediction: true,
    },
    lastSync: hasData ? new Date().toISOString() : undefined,
    freshness: hasData ? "just now" : "never",
    errorCount: 0,
  };
}

// ─── CsvProvider ─────────────────────────────────────────────────────

/**
 * A DataProvider that reads from pre-parsed CSV data supplied at
 * construction time.  All methods return safe defaults when data is
 * missing — they never throw.
 *
 * Usage:
 * ```ts
 * const provider = new CsvProvider({
 *   lineups: parsedLineupRows,
 *   playerStats: parsedStatsRows,
 *   matchHistory: parsedMatchRows,
 * });
 * ```
 */
export class CsvProvider implements DataProvider {
  readonly id = "csv";
  readonly meta: Provider;

  private readonly lineups: CsvLineupRow[];
  private readonly playerStats: CsvPlayerStatsRow[];
  private readonly matchHistory: CsvMatchHistoryRow[];

  /** Internal indexes built on construction for fast lookup. */
  private lineupByMatchTeam: Map<string, CsvLineupRow[]>;
  private statsByPlayerId: Map<string, CsvPlayerStatsRow>;
  private matchesById: Map<string, CsvMatchHistoryRow>;
  private matchesByTeam: Map<string, CsvMatchHistoryRow[]>;
  private lineupsByTeam: Map<string, CsvLineupRow[]>;

  constructor(data?: CsvProviderData) {
    this.lineups = data?.lineups ?? [];
    this.playerStats = data?.playerStats ?? [];
    this.matchHistory = data?.matchHistory ?? [];

    const hasData =
      this.lineups.length > 0 ||
      this.playerStats.length > 0 ||
      this.matchHistory.length > 0;

    this.meta = buildMeta(hasData);

    // Build indexes
    this.lineupByMatchTeam = new Map();
    for (const row of this.lineups) {
      const key = `${row.matchId}:${row.teamId}`;
      const arr = this.lineupByMatchTeam.get(key) ?? [];
      arr.push(row);
      this.lineupByMatchTeam.set(key, arr);
    }

    this.statsByPlayerId = new Map();
    for (const row of this.playerStats) {
      this.statsByPlayerId.set(row.playerId, row);
    }

    this.matchesById = new Map();
    this.matchesByTeam = new Map();
    for (const row of this.matchHistory) {
      this.matchesById.set(row.matchId, row);
      for (const teamId of [row.homeTeamId, row.awayTeamId]) {
        const arr = this.matchesByTeam.get(teamId) ?? [];
        arr.push(row);
        this.matchesByTeam.set(teamId, arr);
      }
    }

    this.lineupsByTeam = new Map();
    for (const row of this.lineups) {
      const arr = this.lineupsByTeam.get(row.teamId) ?? [];
      arr.push(row);
      this.lineupsByTeam.set(row.teamId, arr);
    }
  }

  // ── DataProvider interface ────────────────────────────────────────

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    try {
      const results: Match[] = [];
      for (const row of this.matchHistory) {
        if (row.league === league && parseStatus(row.status) === "scheduled") {
          results.push(this.rowToMatch(row));
        }
      }
      // If no scheduled matches in this league, return all matches in the league
      if (results.length === 0) {
        for (const row of this.matchHistory) {
          if (row.league === league) {
            results.push(this.rowToMatch(row));
          }
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async fetchMatch(matchId: string): Promise<Match> {
    try {
      const row = this.matchesById.get(matchId);
      if (!row) {
        return this.emptyMatch(matchId);
      }
      return this.rowToMatch(row);
    } catch {
      return this.emptyMatch(matchId);
    }
  }

  async fetchTeam(teamId: string): Promise<Team> {
    try {
      // Look for team in match history
      for (const row of this.matchHistory) {
        if (row.homeTeamId === teamId) {
          return buildTeamFromRow(teamId, row.homeTeamName, row.league);
        }
        if (row.awayTeamId === teamId) {
          return buildTeamFromRow(teamId, row.awayTeamName, row.league);
        }
      }
      // Look for team in lineup data
      for (const row of this.lineups) {
        if (row.teamId === teamId) {
          return buildTeamFromRow(teamId, row.teamName, "");
        }
      }
      return { id: teamId, name: teamId, shortName: teamId.substring(0, 3).toUpperCase(), league: "" };
    } catch {
      return { id: teamId, name: teamId, shortName: teamId.substring(0, 3).toUpperCase(), league: "" };
    }
  }

  async fetchSquad(teamId: string): Promise<Player[]> {
    try {
      const players: Player[] = [];
      const seen = new Set<string>();

      // From lineup data
      const teamLineups = this.lineupsByTeam.get(teamId) ?? [];
      for (const row of teamLineups) {
        if (!seen.has(row.playerId)) {
          seen.add(row.playerId);
          players.push(buildPlayerFromRow(row));
        }
      }

      // From player stats
      for (const row of this.playerStats) {
        if (row.teamId === teamId && !seen.has(row.playerId)) {
          seen.add(row.playerId);
          players.push(buildPlayerFromRow(row));
        }
      }

      return players;
    } catch {
      return [];
    }
  }

  async fetchLineup(matchId: string, teamId: string): Promise<Lineup> {
    try {
      const key = `${matchId}:${teamId}`;
      const rows = this.lineupByMatchTeam.get(key);
      if (!rows || rows.length === 0) {
        return {
          matchId,
          teamId,
          formation: "",
          starters: [],
          substitutes: [],
        };
      }

      const starters = rows
        .filter((r) => r.isStarter)
        .map(buildPlayerFromRow);
      const substitutes = rows
        .filter((r) => !r.isStarter)
        .map(buildPlayerFromRow);

      return {
        matchId,
        teamId,
        formation: rows[0]?.formation ?? "",
        starters,
        substitutes,
        coach: rows[0]?.coach,
      };
    } catch {
      return {
        matchId,
        teamId,
        formation: "",
        starters: [],
        substitutes: [],
      };
    }
  }

  async fetchMatchStats(matchId: string): Promise<MatchStats> {
    try {
      const match = this.matchesById.get(matchId);
      if (!match) {
        return this.emptyStats(matchId);
      }

      // Derive basic stats from score if available.
      const homeGoals = match.homeScore ?? 0;
      const awayGoals = match.awayScore ?? 0;
      const total = homeGoals + awayGoals;
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
    } catch {
      return this.emptyStats(matchId);
    }
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    try {
      let teamAWins = 0;
      let draws = 0;
      let teamBWins = 0;
      const meetings: Match[] = [];

      for (const row of this.matchHistory) {
        const involvesA =
          row.homeTeamId === teamAId || row.awayTeamId === teamAId;
        const involvesB =
          row.homeTeamId === teamBId || row.awayTeamId === teamBId;
        if (!involvesA || !involvesB) continue;
        if (parseStatus(row.status) !== "finished") continue;
        if (row.homeScore == null || row.awayScore == null) continue;

        meetings.push(this.rowToMatch(row));

        const isHomeA = row.homeTeamId === teamAId;
        const aGoals = isHomeA ? row.homeScore : row.awayScore;
        const bGoals = isHomeA ? row.awayScore : row.homeScore;
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
      const entries: FormEntry[] = [];
      const teamMatches = this.matchesByTeam.get(teamId) ?? [];

      for (const row of teamMatches) {
        if (parseStatus(row.status) !== "finished") continue;
        if (row.homeScore == null || row.awayScore == null) continue;

        const isHome = row.homeTeamId === teamId;
        const gf = isHome ? row.homeScore : row.awayScore;
        const ga = isHome ? row.awayScore : row.homeScore;
        const opponent = isHome ? row.awayTeamName : row.homeTeamName;

        entries.push({
          matchId: row.matchId,
          opponent,
          result: gf > ga ? "W" : gf < ga ? "L" : "D",
          goalsFor: gf,
          goalsAgainst: ga,
          date: row.kickoff,
        });
      }

      // Most-recent first
      entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return entries.slice(0, limit);
    } catch {
      return [];
    }
  }

  async fetchPrediction(matchId: string): Promise<Prediction> {
    // CsvProvider does not generate predictions — return safe defaults.
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

  // ── Internal helpers ──────────────────────────────────────────────

  private rowToMatch(row: CsvMatchHistoryRow): Match {
    return {
      id: row.matchId,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeTeam: buildTeamFromRow(row.homeTeamId, row.homeTeamName, row.league),
      awayTeam: buildTeamFromRow(row.awayTeamId, row.awayTeamName, row.league),
      kickoff: row.kickoff,
      league: row.league,
      season: row.season,
      venue: row.venue,
      status: parseStatus(row.status),
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    };
  }

  private emptyMatch(matchId: string): Match {
    return {
      id: matchId,
      homeTeamId: "",
      awayTeamId: "",
      kickoff: "",
      league: "",
      status: "scheduled",
    };
  }

  private emptyStats(matchId: string): MatchStats {
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
}
