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
}
