// @lineupcast/providers — ContractAdapter: abstract base for capability-aware providers
//
// Wraps the FootballDataProvider contract with built-in capability gating.
// Concrete provider adapters extend this class and only need to implement
// the methods their data source actually supports.

import type {
  FootballDataProvider,
  ProviderCapabilities,
  ProviderHealthStatus,
  Fixture,
  MatchDetail,
  MatchResult,
  H2HResult,
  SquadPlayer,
  LineupInfo,
  PlayerStats,
} from "./contracts.js";

// ─── Capability keys that map 1:1 to FootballDataProvider methods ────

type MethodCapability = {
  [K in keyof FootballDataProvider]: K extends "id" | "getProviderStatus"
    ? never
    : K;
}[keyof FootballDataProvider];

const METHOD_CAPABILITY_MAP: Record<MethodCapability, keyof ProviderCapabilities> = {
  getFixtures: "fixtures",
  getMatch: "results",
  getRecentMatches: "recentForm",
  getHeadToHead: "h2h",
  getSquad: "squads",
  getLineup: "lineups",
  getPlayerStats: "playerStats",
};

// ─── Capability check error ──────────────────────────────────────────

export class CapabilityError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly method: string,
    public readonly capability: keyof ProviderCapabilities,
  ) {
    super(
      `Provider "${providerId}" does not support "${capability}" (required by ${method})`,
    );
    this.name = "CapabilityError";
  }
}

// ─── ContractAdapter ─────────────────────────────────────────────────

/**
 * Abstract base class for providers implementing the FootballDataProvider contract.
 *
 * Subclasses declare their capabilities via `capabilities` and implement
 * only the methods those capabilities cover. The base class intercepts
 * every public contract method and either:
 *   - delegates to the subclass implementation (capability is true), or
 *   - returns a sensible empty default (capability is false, lenient mode), or
 *   - throws a CapabilityError (capability is false, strict mode).
 *
 * Usage:
 * ```ts
 * class MyProvider extends ContractAdapter {
 *   readonly id = "my-provider";
 *   readonly capabilities = { fixtures: true, results: true, ... };
 *
 *   protected async fetchFixtures(league, from?, to?) { ... }
 *   protected async fetchMatch(matchId) { ... }
 *   // ... only implement what capabilities declare as true
 * }
 * ```
 */
export abstract class ContractAdapter implements FootballDataProvider {
  /** Stable identifier for this provider. */
  abstract readonly id: string;

  /** Capability matrix — subclasses set this to declare what they support. */
  abstract readonly capabilities: ProviderCapabilities;

  /**
   * When true (default), methods called without the matching capability
   * return empty defaults instead of throwing. Set to false for strict
   * mode where a CapabilityError is thrown instead.
   */
  protected readonly lenient = true;

  // ── Capability gating ────────────────────────────────────────────

  /**
   * Check whether a given method capability is supported.
   * In lenient mode returns false silently; in strict mode throws.
   */
  protected assertCapability(method: MethodCapability): boolean {
    const cap = METHOD_CAPABILITY_MAP[method];
    const supported = this.capabilities[cap];
    if (supported) return true;
    if (this.lenient) return false;
    throw new CapabilityError(this.id, method, cap);
  }

  // ── Public contract methods (with capability gating) ─────────────

  async getFixtures(league: string, from?: string, to?: string): Promise<Fixture[]> {
    if (!this.assertCapability("getFixtures")) return [];
    return this.fetchFixtures(league, from, to);
  }

  async getMatch(matchId: string): Promise<MatchDetail> {
    if (!this.assertCapability("getMatch")) {
      return {
        id: matchId,
        homeTeam: "",
        awayTeam: "",
        kickoff: "",
        status: "scheduled",
        league: "",
        events: [],
      };
    }
    return this.fetchMatch(matchId);
  }

  async getRecentMatches(teamId: string, limit?: number): Promise<MatchResult[]> {
    if (!this.assertCapability("getRecentMatches")) return [];
    return this.fetchRecentMatches(teamId, limit);
  }

  async getHeadToHead(teamAId: string, teamBId: string): Promise<H2HResult> {
    if (!this.assertCapability("getHeadToHead")) {
      return {
        totalMatches: 0,
        teamAWins: 0,
        draws: 0,
        teamBWins: 0,
        lastMeetings: [],
      };
    }
    return this.fetchHeadToHead(teamAId, teamBId);
  }

  async getSquad(teamId: string): Promise<SquadPlayer[]> {
    if (!this.assertCapability("getSquad")) return [];
    return this.fetchSquad(teamId);
  }

  async getLineup(matchId: string, teamId: string): Promise<LineupInfo> {
    if (!this.assertCapability("getLineup")) {
      return {
        formation: "",
        starters: [],
        substitutes: [],
      };
    }
    return this.fetchLineup(matchId, teamId);
  }

  async getPlayerStats(playerId: string, season?: string): Promise<PlayerStats> {
    if (!this.assertCapability("getPlayerStats")) {
      return {
        appearances: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
      };
    }
    return this.fetchPlayerStats(playerId, season);
  }

  async getProviderStatus(): Promise<ProviderHealthStatus> {
    return this.fetchProviderStatus();
  }

  // ── Protected abstract hooks for subclasses ──────────────────────
  //
  // Subclasses implement these instead of the public methods.
  // The base class handles capability checks and default returns.

  protected abstract fetchFixtures(
    league: string,
    from?: string,
    to?: string,
  ): Promise<Fixture[]>;

  protected abstract fetchMatch(matchId: string): Promise<MatchDetail>;

  protected abstract fetchRecentMatches(
    teamId: string,
    limit?: number,
  ): Promise<MatchResult[]>;

  protected abstract fetchHeadToHead(
    teamAId: string,
    teamBId: string,
  ): Promise<H2HResult>;

  protected abstract fetchSquad(teamId: string): Promise<SquadPlayer[]>;

  protected abstract fetchLineup(
    matchId: string,
    teamId: string,
  ): Promise<LineupInfo>;

  protected abstract fetchPlayerStats(
    playerId: string,
    season?: string,
  ): Promise<PlayerStats>;

  /**
   * Return provider health status. The base implementation uses the
   * declared capabilities. Subclasses can override to add sync metadata.
   */
  protected async fetchProviderStatus(): Promise<ProviderHealthStatus> {
    return {
      status: "healthy",
      lastSync: null,
      errorCount: 0,
      lastError: null,
      capabilities: { ...this.capabilities },
      freshness: "never",
    };
  }
}
