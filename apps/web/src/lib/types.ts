export interface Player {
  id: string;
  number: number;
  name: string;
  position: string;
  role: string;
  age: number;
  nationality: string;
  recentRating: number;
  xGLast5: number;
  shotsLast5: number;
  assistsLast5: number;
  foulsPer90: number;
  yellowCardsLast10: number;
  redCardsLast10: number;
  vaepAttack: number;
  vaepDefense: number;
  commentaryNote: string;
  x: number;
  y: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  venue: string;
  status: "upcoming" | "live" | "finished";
  minute?: number;
  homeScore?: number;
  awayScore?: number;
}

export interface Prediction {
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  confidence: number;
  possibleScorers: { name: string; probability: number }[];
  yellowCardRisks: { name: string; risk: number }[];
  redCardRisks: { name: string; risk: number }[];
}

export interface DataProvider {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string | null;
  fields: string[];
  errorCount?: number;
  lastError?: string | null;
  lastSuccessfulSync?: string | null;
  freshness?: string;
  health?: "healthy" | "degraded" | "unhealthy";
}

export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string;
  competition: string;
}

export interface H2HRecord {
  matches: H2HMatch[];
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
}

export interface FormEntry {
  matchId: string;
  date: string;
  opponent: string;
  isHome: boolean;
  result: "W" | "D" | "L";
  goalsFor: number;
  goalsAgainst: number;
  xG: number;
  xGA: number;
  venue: string;
}

export interface League {
  id: string;
  name: string;
  shortName: string;
  country: string;
  countryFlag: string;
  season: string;
  isActive: boolean;
}
