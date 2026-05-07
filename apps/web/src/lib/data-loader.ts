import { apiUrl, type ApiMatch, type ApiPrediction } from "./api-client";
import { currentMatch, manchesterRedXI, matchPrediction } from "./mock-data";
import type { Match, Prediction, Player } from "./types";

/* ------------------------------------------------------------------ */
/*  Shared result envelope                                            */
/* ------------------------------------------------------------------ */

export interface LoadResult<T> {
  data: T;
  isDemo: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Internal fetch helper (short timeout, no silent fallback)          */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/*  loadMatch                                                         */
/* ------------------------------------------------------------------ */

export async function loadMatch(
  matchId?: string,
): Promise<LoadResult<Match>> {
  try {
    const apiMatch = await fetchJson<ApiMatch>("/api/matches/demo");
    const match: Match = {
      id: apiMatch.matchId || matchId || currentMatch.id,
      homeTeam: apiMatch.homeTeam.name,
      awayTeam: apiMatch.awayTeam.name,
      kickoff: apiMatch.kickoff,
      venue: (apiMatch as unknown as Record<string, unknown>).venue as string ?? currentMatch.venue,
      status: (apiMatch.status as Match["status"]) ?? "upcoming",
    };
    return { data: match, isDemo: false, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { data: currentMatch, isDemo: true, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/*  loadPrediction                                                    */
/* ------------------------------------------------------------------ */

function mapApiPrediction(raw: ApiPrediction): Prediction {
  return {
    homeWin: raw.homeWin,
    draw: raw.draw,
    awayWin: raw.awayWin,
    expectedHomeGoals: raw.expectedHomeGoals,
    expectedAwayGoals: raw.expectedAwayGoals,
    confidence: raw.confidence,
    possibleScorers: (raw.goalScorers ?? []).map((s) => ({
      name: s.player,
      probability: s.probability,
    })),
    yellowCardRisks: (raw.cardRisks ?? []).map((r) => ({
      name: r.player,
      risk: r.yellowRisk,
    })),
    redCardRisks: [],
  };
}

export async function loadPrediction(
  matchId: string,
): Promise<LoadResult<Prediction>> {
  try {
    const raw = await fetchJson<ApiPrediction>(
      `/api/matches/${matchId}/prediction`,
    );
    return { data: mapApiPrediction(raw), isDemo: false, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { data: matchPrediction, isDemo: true, error: msg };
  }
}

/* ------------------------------------------------------------------ */
/*  loadLineups                                                       */
/* ------------------------------------------------------------------ */

interface ApiLineupResponse {
  players?: Partial<Player>[];
}

function mapPlayers(raw: Partial<Player>[]): Player[] {
  return raw.map((p, i) => ({
    id: p.id ?? `player-${i}`,
    number: p.number ?? i + 1,
    name: p.name ?? "Unknown",
    position: p.position ?? "MF",
    role: p.role ?? "Midfielder",
    age: p.age ?? 25,
    nationality: p.nationality ?? "UNK",
    recentRating: p.recentRating ?? 6.5,
    xGLast5: p.xGLast5 ?? 0,
    shotsLast5: p.shotsLast5 ?? 0,
    assistsLast5: p.assistsLast5 ?? 0,
    foulsPer90: p.foulsPer90 ?? 0,
    yellowCardsLast10: p.yellowCardsLast10 ?? 0,
    redCardsLast10: p.redCardsLast10 ?? 0,
    vaepAttack: p.vaepAttack ?? 0,
    vaepDefense: p.vaepDefense ?? 0,
    commentaryNote: p.commentaryNote ?? "",
    x: p.x ?? 50,
    y: p.y ?? 50,
  }));
}

export async function loadLineups(
  matchId: string,
): Promise<LoadResult<Player[]>> {
  try {
    const raw = await fetchJson<ApiLineupResponse>(
      `/api/matches/${matchId}/lineup`,
    );
    if (raw.players && raw.players.length > 0) {
      return { data: mapPlayers(raw.players), isDemo: false, error: null };
    }
    return { data: manchesterRedXI, isDemo: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { data: manchesterRedXI, isDemo: true, error: msg };
  }
}
