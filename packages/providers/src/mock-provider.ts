// @lineupcast/providers — MockProvider returning demo data

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
  PlayerGoalPrediction,
  PlayerCardPrediction,
} from "@lineupcast/schema";
import type { DataProvider } from "./data-provider.js";

const PROVIDER_META: Provider = {
  id: "mock",
  name: "Mock Provider",
  description: "Returns deterministic demo data for development and testing. No external API calls.",
  requiresApiKey: false,
  tokenConfigured: false,
};

// ─── Teams ───────────────────────────────────────────────────────────

const MANCHESTER_RED: Team = {
  id: "manchester-red",
  name: "Manchester Red",
  shortName: "RED",
  league: "Demo Premier League",
  country: "England",
  founded: 1902,
  venue: "Red Arena",
};

const SHANGHAI_HARBOR: Team = {
  id: "shanghai-harbor",
  name: "Shanghai Harbor",
  shortName: "SHA",
  league: "Demo Premier League",
  country: "China",
  founded: 2005,
  venue: "Harbor Stadium",
};

// ─── Manchester Red XI ───────────────────────────────────────────────

const RED_STARTERS: Player[] = [
  { id: "red-1", name: "A. Keeper", teamId: "manchester-red", position: "GK", number: 1, nationality: "Fictionland", age: 28, rating: 78 },
  { id: "red-2", name: "L. Wing", teamId: "manchester-red", position: "RB", number: 2, nationality: "Fictionland", age: 25, rating: 76 },
  { id: "red-3", name: "N. Cross", teamId: "manchester-red", position: "LB", number: 3, nationality: "Fictionland", age: 27, rating: 77 },
  { id: "red-4", name: "M. Stone", teamId: "manchester-red", position: "CB", number: 4, nationality: "Fictionland", age: 29, rating: 79 },
  { id: "red-5", name: "R. Block", teamId: "manchester-red", position: "CB", number: 5, nationality: "Fictionland", age: 30, rating: 78 },
  { id: "red-6", name: "D. Tempo", teamId: "manchester-red", position: "DM", number: 6, nationality: "Fictionland", age: 26, rating: 80 },
  { id: "red-7", name: "C. Press", teamId: "manchester-red", position: "DM", number: 7, nationality: "Fictionland", age: 24, rating: 77, captain: true },
  { id: "red-8", name: "J. Spark", teamId: "manchester-red", position: "RW", number: 8, nationality: "Fictionland", age: 23, rating: 79 },
  { id: "red-9", name: "B. Vision", teamId: "manchester-red", position: "AM", number: 9, nationality: "Fictionland", age: 25, rating: 81 },
  { id: "red-10", name: "K. Burst", teamId: "manchester-red", position: "LW", number: 10, nationality: "Fictionland", age: 22, rating: 78 },
  { id: "red-11", name: "V. Finish", teamId: "manchester-red", position: "ST", number: 11, nationality: "Fictionland", age: 24, rating: 82 },
];

const RED_SUBS: Player[] = [
  { id: "red-12", name: "P. Save", teamId: "manchester-red", position: "GK", number: 12, nationality: "Fictionland", age: 31, rating: 72 },
  { id: "red-13", name: "T. Shield", teamId: "manchester-red", position: "CB", number: 13, nationality: "Fictionland", age: 28, rating: 74 },
  { id: "red-14", name: "G. Drive", teamId: "manchester-red", position: "CM", number: 14, nationality: "Fictionland", age: 26, rating: 73 },
  { id: "red-15", name: "M. Dribble", teamId: "manchester-red", position: "RW", number: 15, nationality: "Fictionland", age: 21, rating: 71 },
  { id: "red-16", name: "F. Pace", teamId: "manchester-red", position: "LW", number: 16, nationality: "Fictionland", age: 20, rating: 70 },
];

const SHA_STARTERS: Player[] = [
  { id: "sha-1", name: "W. Shield", teamId: "shanghai-harbor", position: "GK", number: 1, nationality: "Fictionland", age: 29, rating: 74 },
  { id: "sha-2", name: "Z. Flank", teamId: "shanghai-harbor", position: "RB", number: 2, nationality: "Fictionland", age: 26, rating: 70 },
  { id: "sha-3", name: "H. Wall", teamId: "shanghai-harbor", position: "CB", number: 3, nationality: "Fictionland", age: 28, rating: 72 },
  { id: "sha-4", name: "J. Anchor", teamId: "shanghai-harbor", position: "CB", number: 4, nationality: "Fictionland", age: 30, rating: 71 },
  { id: "sha-5", name: "L. Edge", teamId: "shanghai-harbor", position: "LB", number: 5, nationality: "Fictionland", age: 25, rating: 69 },
  { id: "sha-6", name: "D. Anchor", teamId: "shanghai-harbor", position: "DM", number: 6, nationality: "Fictionland", age: 27, rating: 73 },
  { id: "sha-7", name: "M. Rhythm", teamId: "shanghai-harbor", position: "CM", number: 7, nationality: "Fictionland", age: 24, rating: 72 },
  { id: "sha-8", name: "P. Orchid", teamId: "shanghai-harbor", position: "CM", number: 8, nationality: "Fictionland", age: 26, rating: 71 },
  { id: "sha-9", name: "H. Counter", teamId: "shanghai-harbor", position: "RW", number: 9, nationality: "Fictionland", age: 23, rating: 74 },
  { id: "sha-10", name: "S. Late", teamId: "shanghai-harbor", position: "LW", number: 10, nationality: "Fictionland", age: 25, rating: 73 },
  { id: "sha-11", name: "T. Marksman", teamId: "shanghai-harbor", position: "ST", number: 11, nationality: "Fictionland", age: 27, rating: 75 },
];

const SHA_SUBS: Player[] = [
  { id: "sha-12", name: "Q. Gloves", teamId: "shanghai-harbor", position: "GK", number: 12, nationality: "Fictionland", age: 32, rating: 66 },
  { id: "sha-13", name: "Y. Marker", teamId: "shanghai-harbor", position: "CB", number: 13, nationality: "Fictionland", age: 29, rating: 67 },
  { id: "sha-14", name: "X. Pass", teamId: "shanghai-harbor", position: "CM", number: 14, nationality: "Fictionland", age: 22, rating: 65 },
  { id: "sha-15", name: "R. Sprint", teamId: "shanghai-harbor", position: "LW", number: 15, nationality: "Fictionland", age: 21, rating: 64 },
];

// ─── Match ───────────────────────────────────────────────────────────

const DEMO_MATCH_ID = "demo-mr-vs-sh-001";
const DEMO_KICKOFF = "2026-05-10T15:00:00Z";

const DEMO_MATCH: Match = {
  id: DEMO_MATCH_ID,
  homeTeamId: "manchester-red",
  awayTeamId: "shanghai-harbor",
  homeTeam: MANCHESTER_RED,
  awayTeam: SHANGHAI_HARBOR,
  kickoff: DEMO_KICKOFF,
  league: "Demo Premier League",
  season: "2025-26",
  matchday: 36,
  venue: "Red Arena",
  referee: "A. Whistle",
  status: "scheduled",
};

// ─── Predictions ─────────────────────────────────────────────────────

const RED_PLAYER_GOALS: PlayerGoalPrediction[] = [
  { playerId: "red-11", playerName: "V. Finish", teamId: "manchester-red", probability: 0.34, firstGoal: 0.14, anytime: 0.34, brace: 0.08, hatTrick: 0.01 },
  { playerId: "red-8", playerName: "J. Spark", teamId: "manchester-red", probability: 0.22, firstGoal: 0.08, anytime: 0.22, brace: 0.04 },
  { playerId: "red-10", playerName: "K. Burst", teamId: "manchester-red", probability: 0.18, firstGoal: 0.06, anytime: 0.18, brace: 0.03 },
  { playerId: "sha-9", playerName: "H. Counter", teamId: "shanghai-harbor", probability: 0.17, firstGoal: 0.06, anytime: 0.17, brace: 0.02 },
];

const RED_PLAYER_CARDS: PlayerCardPrediction[] = [
  { playerId: "red-7", playerName: "C. Press", teamId: "manchester-red", yellowCardProbability: 0.42, foulProbability: 0.52 },
  { playerId: "red-5", playerName: "R. Block", teamId: "manchester-red", yellowCardProbability: 0.31, foulProbability: 0.44 },
  { playerId: "sha-6", playerName: "D. Anchor", teamId: "shanghai-harbor", yellowCardProbability: 0.38, foulProbability: 0.48 },
  { playerId: "sha-10", playerName: "S. Late", teamId: "shanghai-harbor", yellowCardProbability: 0.26, redCardRiskLevel: "low", foulProbability: 0.35 },
];

const DEMO_PREDICTION: Prediction = {
  matchId: DEMO_MATCH_ID,
  homeWin: 0.48,
  draw: 0.27,
  awayWin: 0.25,
  expectedHomeGoals: 1.6,
  expectedAwayGoals: 1.2,
  confidence: "medium",
  btts: 0.38,
  over25: 0.45,
  under25: 0.55,
  homeCleanSheet: 0.32,
  awayCleanSheet: 0.18,
  playerGoalPredictions: RED_PLAYER_GOALS,
  playerCardPredictions: RED_PLAYER_CARDS,
};

// ─── H2H / Form / Stats ─────────────────────────────────────────────

const DEMO_H2H: H2HRecord = {
  teamAId: "manchester-red",
  teamBId: "shanghai-harbor",
  totalMatches: 3,
  teamAWins: 2,
  draws: 1,
  teamBWins: 0,
  lastMeetings: [],
};

const RED_FORM: FormEntry[] = [
  { matchId: "red-f1", opponent: "Liverpool Blue", result: "W", goalsFor: 3, goalsAgainst: 1, date: "2026-04-20" },
  { matchId: "red-f2", opponent: "London Spurs", result: "D", goalsFor: 1, goalsAgainst: 1, date: "2026-04-13" },
  { matchId: "red-f3", opponent: "Milan Stripes", result: "W", goalsFor: 2, goalsAgainst: 0, date: "2026-04-06" },
  { matchId: "red-f4", opponent: "Madrid Whites", result: "L", goalsFor: 0, goalsAgainst: 2, date: "2026-03-30" },
  { matchId: "red-f5", opponent: "Berlin Eagles", result: "W", goalsFor: 4, goalsAgainst: 2, date: "2026-03-23" },
];

const DEMO_STATS: MatchStats = {
  matchId: DEMO_MATCH_ID,
  homeXG: 1.6,
  awayXG: 1.2,
  homePossession: 58,
  awayPossession: 42,
  homeShots: 13,
  awayShots: 10,
  homeShotsOnTarget: 5,
  awayShotsOnTarget: 4,
  homeCorners: 6,
  awayCorners: 4,
  homeFouls: 11,
  awayFouls: 13,
  homeYellowCards: 2,
  awayYellowCards: 2,
  homeRedCards: 0,
  awayRedCards: 0,
};

// ─── MockProvider Implementation ─────────────────────────────────────

export class MockProvider implements DataProvider {
  readonly id = "mock";
  readonly meta = PROVIDER_META;

  async fetchUpcomingMatches(_league: string): Promise<Match[]> {
    return [structuredClone(DEMO_MATCH)];
  }

  async fetchMatch(matchId: string): Promise<Match> {
    if (matchId !== DEMO_MATCH_ID) throw new Error(`Mock: unknown match ${matchId}`);
    return structuredClone(DEMO_MATCH);
  }

  async fetchTeam(teamId: string): Promise<Team> {
    if (teamId === "manchester-red") return structuredClone(MANCHESTER_RED);
    if (teamId === "shanghai-harbor") return structuredClone(SHANGHAI_HARBOR);
    throw new Error(`Mock: unknown team ${teamId}`);
  }

  async fetchSquad(teamId: string): Promise<Player[]> {
    if (teamId === "manchester-red") return structuredClone([...RED_STARTERS, ...RED_SUBS]);
    if (teamId === "shanghai-harbor") return structuredClone([...SHA_STARTERS, ...SHA_SUBS]);
    throw new Error(`Mock: unknown team ${teamId}`);
  }

  async fetchLineup(matchId: string, teamId: string): Promise<Lineup> {
    if (matchId !== DEMO_MATCH_ID) throw new Error(`Mock: unknown match ${matchId}`);
    if (teamId === "manchester-red") {
      return { matchId, teamId, formation: "4-2-3-1", starters: structuredClone(RED_STARTERS), substitutes: structuredClone(RED_SUBS), coach: "R. Manager" };
    }
    if (teamId === "shanghai-harbor") {
      return { matchId, teamId, formation: "4-4-2", starters: structuredClone(SHA_STARTERS), substitutes: structuredClone(SHA_SUBS), coach: "L. Tactician" };
    }
    throw new Error(`Mock: unknown team ${teamId}`);
  }

  async fetchMatchStats(matchId: string): Promise<MatchStats> {
    if (matchId !== DEMO_MATCH_ID) throw new Error(`Mock: unknown match ${matchId}`);
    return structuredClone(DEMO_STATS);
  }

  async fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord> {
    const ids = new Set([teamAId, teamBId]);
    if (!ids.has("manchester-red") || !ids.has("shanghai-harbor")) {
      throw new Error(`Mock: unknown H2H pairing ${teamAId} vs ${teamBId}`);
    }
    return structuredClone(DEMO_H2H);
  }

  async fetchForm(teamId: string, limit = 5): Promise<FormEntry[]> {
    if (teamId === "manchester-red") return structuredClone(RED_FORM.slice(0, limit));
    return [];
  }

  async fetchPrediction(matchId: string): Promise<Prediction> {
    if (matchId !== DEMO_MATCH_ID) throw new Error(`Mock: unknown match ${matchId}`);
    return structuredClone(DEMO_PREDICTION);
  }
}
