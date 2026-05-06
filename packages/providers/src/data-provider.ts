// @lineupcast/providers — DataProvider interface

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

/**
 * Every data-source adapter implements this interface.
 * Methods are intentionally broad — providers that lack a capability
 * return empty/default values rather than throwing.
 */
export interface DataProvider {
  /** Stable identifier, e.g. "openfootball", "mock" */
  readonly id: string;
  /** Human-readable provider metadata */
  readonly meta: Provider;

  fetchUpcomingMatches(league: string): Promise<Match[]>;
  fetchMatch(matchId: string): Promise<Match>;
  fetchTeam(teamId: string): Promise<Team>;
  fetchSquad(teamId: string): Promise<Player[]>;
  fetchLineup(matchId: string, teamId: string): Promise<Lineup>;
  fetchMatchStats(matchId: string): Promise<MatchStats>;
  fetchH2H(teamAId: string, teamBId: string): Promise<H2HRecord>;
  fetchForm(teamId: string, limit?: number): Promise<FormEntry[]>;
  fetchPrediction(matchId: string): Promise<Prediction>;
}
