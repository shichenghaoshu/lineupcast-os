// @lineupcast/providers — Contract tests for FootballDataProvider and related types
//
// Validates that providers implement the correct interfaces and that the
// ContractAdapter correctly gates capabilities. All tests use mock
// implementations — no real HTTP calls are made.

import { describe, it, expect } from "vitest";
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
  MatchEvent,
  MatchStatistics,
} from "../contracts.js";
import { ContractAdapter, CapabilityError } from "../contract-adapter.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Verify that a value satisfies the ProviderCapabilities shape. */
function expectCapabilities(caps: ProviderCapabilities): void {
  expect(typeof caps.fixtures).toBe("boolean");
  expect(typeof caps.results).toBe("boolean");
  expect(typeof caps.recentForm).toBe("boolean");
  expect(typeof caps.h2h).toBe("boolean");
  expect(typeof caps.squads).toBe("boolean");
  expect(typeof caps.lineups).toBe("boolean");
  expect(typeof caps.playerStats).toBe("boolean");
  expect(typeof caps.injuries).toBe("boolean");
  expect(typeof caps.referee).toBe("boolean");
  expect(typeof caps.events).toBe("boolean");
}

/** All capability keys for iteration in tests. */
const ALL_CAPABILITY_KEYS: (keyof ProviderCapabilities)[] = [
  "fixtures",
  "results",
  "recentForm",
  "h2h",
  "squads",
  "lineups",
  "playerStats",
  "injuries",
  "referee",
  "events",
];

// ─── Mock Data ────────────────────────────────────────────────────────────

const MOCK_FIXTURE: Fixture = {
  id: "fix-001",
  homeTeam: "Manchester Red",
  awayTeam: "Shanghai Harbor",
  kickoff: "2026-05-10T15:00:00Z",
  venue: "Red Arena",
  referee: "A. Official",
  status: "scheduled",
  league: "premier-league",
  season: "2025-26",
};

const MOCK_MATCH_EVENT: MatchEvent = {
  minute: 42,
  type: "goal",
  team: "home",
  player: "V. Finish",
  assist: "J. Spark",
};

const MOCK_MATCH_STATISTICS: MatchStatistics = {
  homePossession: 55,
  awayPossession: 45,
  homeShots: 14,
  awayShots: 8,
  homeShotsOnTarget: 6,
  awayShotsOnTarget: 3,
  homeCorners: 7,
  awayCorners: 4,
  homeFouls: 11,
  awayFouls: 13,
  homeXG: 1.6,
  awayXG: 0.9,
};

const MOCK_MATCH_DETAIL: MatchDetail = {
  ...MOCK_FIXTURE,
  homeScore: 2,
  awayScore: 1,
  events: [MOCK_MATCH_EVENT],
  stats: MOCK_MATCH_STATISTICS,
  homeLineup: {
    formation: "4-2-3-1",
    starters: [],
    substitutes: [],
    coach: "R. Manager",
  },
  awayLineup: {
    formation: "4-4-2",
    starters: [],
    substitutes: [],
    coach: "L. Tactician",
  },
};

const MOCK_MATCH_RESULT: MatchResult = {
  matchId: "fix-001",
  date: "2026-05-03T15:00:00Z",
  opponent: "Shanghai Harbor",
  isHome: true,
  goalsFor: 2,
  goalsAgainst: 1,
  result: "W",
};

const MOCK_H2H: H2HResult = {
  totalMatches: 5,
  teamAWins: 3,
  draws: 1,
  teamBWins: 1,
  lastMeetings: [MOCK_MATCH_RESULT],
};

const MOCK_SQUAD_PLAYER: SquadPlayer = {
  playerId: "sp-001",
  name: "V. Finish",
  position: "Forward",
  number: 9,
  nationality: "England",
  age: 27,
  injured: false,
};

const MOCK_SQUAD_PLAYER_INJURED: SquadPlayer = {
  playerId: "sp-002",
  name: "D. Tempo",
  position: "Midfielder",
  number: 8,
  injured: true,
  injuryNote: "Hamstring strain",
};

const MOCK_LINEUP: LineupInfo = {
  formation: "4-2-3-1",
  starters: [MOCK_SQUAD_PLAYER],
  substitutes: [MOCK_SQUAD_PLAYER_INJURED],
  coach: "R. Manager",
};

const MOCK_PLAYER_STATS: PlayerStats = {
  appearances: 34,
  goals: 18,
  assists: 7,
  xG: 15.2,
  xA: 6.8,
  yellowCards: 3,
  redCards: 0,
  minutesPlayed: 2880,
  rating: 7.4,
};

const ALL_CAPABILITIES_ENABLED: ProviderCapabilities = {
  fixtures: true,
  results: true,
  recentForm: true,
  h2h: true,
  squads: true,
  lineups: true,
  playerStats: true,
  injuries: true,
  referee: true,
  events: true,
};

const ALL_CAPABILITIES_DISABLED: ProviderCapabilities = {
  fixtures: false,
  results: false,
  recentForm: false,
  h2h: false,
  squads: false,
  lineups: false,
  playerStats: false,
  injuries: false,
  referee: false,
  events: false,
};

const MOCK_HEALTH_STATUS: ProviderHealthStatus = {
  status: "healthy",
  lastSync: "2026-05-06T10:00:00Z",
  errorCount: 0,
  lastError: null,
  capabilities: ALL_CAPABILITIES_ENABLED,
  freshness: "2m ago",
};

// ─── Concrete Mock: Full FootballDataProvider ─────────────────────────────

class FullMockProvider implements FootballDataProvider {
  readonly id = "mock-full";

  async getFixtures(_league: string, _from?: string, _to?: string): Promise<Fixture[]> {
    return [MOCK_FIXTURE];
  }

  async getMatch(_matchId: string): Promise<MatchDetail> {
    return { ...MOCK_MATCH_DETAIL };
  }

  async getRecentMatches(_teamId: string, _limit?: number): Promise<MatchResult[]> {
    return [MOCK_MATCH_RESULT];
  }

  async getHeadToHead(_teamAId: string, _teamBId: string): Promise<H2HResult> {
    return { ...MOCK_H2H, lastMeetings: [...MOCK_H2H.lastMeetings] };
  }

  async getSquad(_teamId: string): Promise<SquadPlayer[]> {
    return [MOCK_SQUAD_PLAYER, MOCK_SQUAD_PLAYER_INJURED];
  }

  async getLineup(_matchId: string, _teamId: string): Promise<LineupInfo> {
    return { ...MOCK_LINEUP, starters: [...MOCK_LINEUP.starters], substitutes: [...MOCK_LINEUP.substitutes] };
  }

  async getPlayerStats(_playerId: string, _season?: string): Promise<PlayerStats> {
    return { ...MOCK_PLAYER_STATS };
  }

  async getProviderStatus(): Promise<ProviderHealthStatus> {
    return { ...MOCK_HEALTH_STATUS, capabilities: { ...MOCK_HEALTH_STATUS.capabilities } };
  }
}

// ─── Concrete Mock: ContractAdapter with full capabilities ────────────────

class FullContractAdapter extends ContractAdapter {
  readonly id = "adapter-full";
  readonly capabilities: ProviderCapabilities = { ...ALL_CAPABILITIES_ENABLED };

  protected async fetchFixtures(_league: string, _from?: string, _to?: string): Promise<Fixture[]> {
    return [MOCK_FIXTURE];
  }

  protected async fetchMatch(_matchId: string): Promise<MatchDetail> {
    return { ...MOCK_MATCH_DETAIL };
  }

  protected async fetchRecentMatches(_teamId: string, _limit?: number): Promise<MatchResult[]> {
    return [MOCK_MATCH_RESULT];
  }

  protected async fetchHeadToHead(_teamAId: string, _teamBId: string): Promise<H2HResult> {
    return { ...MOCK_H2H, lastMeetings: [...MOCK_H2H.lastMeetings] };
  }

  protected async fetchSquad(_teamId: string): Promise<SquadPlayer[]> {
    return [MOCK_SQUAD_PLAYER, MOCK_SQUAD_PLAYER_INJURED];
  }

  protected async fetchLineup(_matchId: string, _teamId: string): Promise<LineupInfo> {
    return { ...MOCK_LINEUP, starters: [...MOCK_LINEUP.starters], substitutes: [...MOCK_LINEUP.substitutes] };
  }

  protected async fetchPlayerStats(_playerId: string, _season?: string): Promise<PlayerStats> {
    return { ...MOCK_PLAYER_STATS };
  }
}

// ─── Concrete Mock: ContractAdapter with no capabilities (strict mode) ────

class StrictEmptyAdapter extends ContractAdapter {
  readonly id = "adapter-strict-empty";
  readonly capabilities: ProviderCapabilities = { ...ALL_CAPABILITIES_DISABLED };
  protected readonly lenient = false;

  protected async fetchFixtures(): Promise<Fixture[]> { return []; }
  protected async fetchMatch(): Promise<MatchDetail> { return MOCK_MATCH_DETAIL; }
  protected async fetchRecentMatches(): Promise<MatchResult[]> { return []; }
  protected async fetchHeadToHead(): Promise<H2HResult> { return MOCK_H2H; }
  protected async fetchSquad(): Promise<SquadPlayer[]> { return []; }
  protected async fetchLineup(): Promise<LineupInfo> { return MOCK_LINEUP; }
  protected async fetchPlayerStats(): Promise<PlayerStats> { return MOCK_PLAYER_STATS; }
}

// ─── Concrete Mock: ContractAdapter with partial capabilities ─────────────

class PartialContractAdapter extends ContractAdapter {
  readonly id = "adapter-partial";
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    results: true,
    recentForm: false,
    h2h: false,
    squads: false,
    lineups: false,
    playerStats: false,
    injuries: false,
    referee: false,
    events: false,
  };

  protected async fetchFixtures(_league: string, _from?: string, _to?: string): Promise<Fixture[]> {
    return [MOCK_FIXTURE];
  }

  protected async fetchMatch(_matchId: string): Promise<MatchDetail> {
    return { ...MOCK_MATCH_DETAIL };
  }

  protected async fetchRecentMatches(): Promise<MatchResult[]> { return []; }
  protected async fetchHeadToHead(): Promise<H2HResult> { return MOCK_H2H; }
  protected async fetchSquad(): Promise<SquadPlayer[]> { return []; }
  protected async fetchLineup(): Promise<LineupInfo> { return MOCK_LINEUP; }
  protected async fetchPlayerStats(): Promise<PlayerStats> { return MOCK_PLAYER_STATS; }
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Suites
// ═══════════════════════════════════════════════════════════════════════════

describe("FootballDataProvider interface compliance", () => {
  const provider = new FullMockProvider();

  it("has a readonly id string", () => {
    expect(typeof provider.id).toBe("string");
    expect(provider.id.length).toBeGreaterThan(0);
  });

  it("implements getFixtures returning Fixture[]", async () => {
    const fixtures = await provider.getFixtures("premier-league");
    expect(Array.isArray(fixtures)).toBe(true);
  });

  it("implements getMatch returning MatchDetail", async () => {
    const detail = await provider.getMatch("fix-001");
    expect(typeof detail.id).toBe("string");
    expect(typeof detail.homeTeam).toBe("string");
    expect(typeof detail.awayTeam).toBe("string");
    expect(Array.isArray(detail.events)).toBe(true);
  });

  it("implements getRecentMatches returning MatchResult[]", async () => {
    const results = await provider.getRecentMatches("team-001");
    expect(Array.isArray(results)).toBe(true);
  });

  it("implements getHeadToHead returning H2HResult", async () => {
    const h2h = await provider.getHeadToHead("team-a", "team-b");
    expect(typeof h2h.totalMatches).toBe("number");
    expect(typeof h2h.teamAWins).toBe("number");
    expect(typeof h2h.draws).toBe("number");
    expect(typeof h2h.teamBWins).toBe("number");
    expect(Array.isArray(h2h.lastMeetings)).toBe(true);
  });

  it("implements getSquad returning SquadPlayer[]", async () => {
    const squad = await provider.getSquad("team-001");
    expect(Array.isArray(squad)).toBe(true);
  });

  it("implements getLineup returning LineupInfo", async () => {
    const lineup = await provider.getLineup("fix-001", "team-001");
    expect(typeof lineup.formation).toBe("string");
    expect(Array.isArray(lineup.starters)).toBe(true);
    expect(Array.isArray(lineup.substitutes)).toBe(true);
  });

  it("implements getPlayerStats returning PlayerStats", async () => {
    const stats = await provider.getPlayerStats("player-001");
    expect(typeof stats.appearances).toBe("number");
    expect(typeof stats.goals).toBe("number");
    expect(typeof stats.assists).toBe("number");
    expect(typeof stats.yellowCards).toBe("number");
    expect(typeof stats.redCards).toBe("number");
    expect(typeof stats.minutesPlayed).toBe("number");
  });

  it("implements getProviderStatus returning ProviderHealthStatus", async () => {
    const status = await provider.getProviderStatus();
    expect(typeof status.status).toBe("string");
    expect(typeof status.errorCount).toBe("number");
    expect(typeof status.freshness).toBe("string");
    expect(status.capabilities).toBeDefined();
  });
});

describe("ProviderCapabilities matrix validation", () => {
  it("contains all 10 required capability keys", () => {
    expectCapabilities(ALL_CAPABILITIES_ENABLED);
    expectCapabilities(ALL_CAPABILITIES_DISABLED);
  });

  it("ALL_CAPABILITIES_ENABLED has every key set to true", () => {
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(ALL_CAPABILITIES_ENABLED[key]).toBe(true);
    }
  });

  it("ALL_CAPABILITIES_DISABLED has every key set to false", () => {
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(ALL_CAPABILITIES_DISABLED[key]).toBe(false);
    }
  });

  it("does not allow unknown capability keys to be truthy by accident", () => {
    const caps: ProviderCapabilities = { ...ALL_CAPABILITIES_DISABLED };
    const knownKeys = new Set<string>(ALL_CAPABILITY_KEYS);
    const allOwnKeys = Object.keys(caps);
    for (const key of allOwnKeys) {
      expect(knownKeys.has(key)).toBe(true);
    }
    expect(allOwnKeys.length).toBe(ALL_CAPABILITY_KEYS.length);
  });

  it("partial capabilities can be individually toggled", () => {
    const partial: ProviderCapabilities = {
      fixtures: true,
      results: false,
      recentForm: true,
      h2h: false,
      squads: false,
      lineups: true,
      playerStats: false,
      injuries: false,
      referee: true,
      events: false,
    };
    expectCapabilities(partial);
    expect(partial.fixtures).toBe(true);
    expect(partial.results).toBe(false);
    expect(partial.lineups).toBe(true);
    expect(partial.referee).toBe(true);
  });
});

describe("ContractAdapter wraps provider correctly", () => {
  const adapter = new FullContractAdapter();

  it("implements the FootballDataProvider interface", () => {
    expect(typeof adapter.id).toBe("string");
    expect(typeof adapter.getFixtures).toBe("function");
    expect(typeof adapter.getMatch).toBe("function");
    expect(typeof adapter.getRecentMatches).toBe("function");
    expect(typeof adapter.getHeadToHead).toBe("function");
    expect(typeof adapter.getSquad).toBe("function");
    expect(typeof adapter.getLineup).toBe("function");
    expect(typeof adapter.getPlayerStats).toBe("function");
    expect(typeof adapter.getProviderStatus).toBe("function");
  });

  it("delegates getFixtures to subclass implementation when capability is true", async () => {
    const fixtures = await adapter.getFixtures("premier-league");
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]!.id).toBe("fix-001");
  });

  it("delegates getMatch to subclass implementation when capability is true", async () => {
    const detail = await adapter.getMatch("fix-001");
    expect(detail.id).toBe("fix-001");
    expect(detail.homeScore).toBe(2);
    expect(detail.awayScore).toBe(1);
  });

  it("delegates getRecentMatches to subclass implementation when capability is true", async () => {
    const results = await adapter.getRecentMatches("team-001");
    expect(results).toHaveLength(1);
    expect(results[0]!.result).toBe("W");
  });

  it("delegates getHeadToHead to subclass implementation when capability is true", async () => {
    const h2h = await adapter.getHeadToHead("team-a", "team-b");
    expect(h2h.totalMatches).toBe(5);
    expect(h2h.teamAWins).toBe(3);
  });

  it("delegates getSquad to subclass implementation when capability is true", async () => {
    const squad = await adapter.getSquad("team-001");
    expect(squad).toHaveLength(2);
    expect(squad[0]!.name).toBe("V. Finish");
  });

  it("delegates getLineup to subclass implementation when capability is true", async () => {
    const lineup = await adapter.getLineup("fix-001", "team-001");
    expect(lineup.formation).toBe("4-2-3-1");
    expect(lineup.coach).toBe("R. Manager");
  });

  it("delegates getPlayerStats to subclass implementation when capability is true", async () => {
    const stats = await adapter.getPlayerStats("sp-001");
    expect(stats.appearances).toBe(34);
    expect(stats.goals).toBe(18);
  });

  it("returns capabilities matching the declared matrix from getProviderStatus", async () => {
    const status = await adapter.getProviderStatus();
    expectCapabilities(status.capabilities);
    for (const key of ALL_CAPABILITY_KEYS) {
      expect(status.capabilities[key]).toBe(true);
    }
  });
});

describe("ContractAdapter blocks unsupported capabilities", () => {
  describe("lenient mode (default) — returns empty defaults", () => {
    const adapter = new PartialContractAdapter();

    it("getFixtures returns real data when fixtures capability is true", async () => {
      const fixtures = await adapter.getFixtures("premier-league");
      expect(fixtures).toHaveLength(1);
    });

    it("getMatch returns real data when results capability is true", async () => {
      const detail = await adapter.getMatch("fix-001");
      expect(detail.id).toBe("fix-001");
    });

    it("getRecentMatches returns empty array when recentForm is false", async () => {
      const results = await adapter.getRecentMatches("team-001");
      expect(results).toEqual([]);
    });

    it("getHeadToHead returns empty default when h2h is false", async () => {
      const h2h = await adapter.getHeadToHead("team-a", "team-b");
      expect(h2h.totalMatches).toBe(0);
      expect(h2h.teamAWins).toBe(0);
      expect(h2h.draws).toBe(0);
      expect(h2h.teamBWins).toBe(0);
      expect(h2h.lastMeetings).toEqual([]);
    });

    it("getSquad returns empty array when squads is false", async () => {
      const squad = await adapter.getSquad("team-001");
      expect(squad).toEqual([]);
    });

    it("getLineup returns empty default when lineups is false", async () => {
      const lineup = await adapter.getLineup("fix-001", "team-001");
      expect(lineup.formation).toBe("");
      expect(lineup.starters).toEqual([]);
      expect(lineup.substitutes).toEqual([]);
    });

    it("getPlayerStats returns zeroed default when playerStats is false", async () => {
      const stats = await adapter.getPlayerStats("player-001");
      expect(stats.appearances).toBe(0);
      expect(stats.goals).toBe(0);
      expect(stats.assists).toBe(0);
      expect(stats.yellowCards).toBe(0);
      expect(stats.redCards).toBe(0);
      expect(stats.minutesPlayed).toBe(0);
    });
  });

  describe("strict mode — throws CapabilityError", () => {
    const adapter = new StrictEmptyAdapter();

    it("getFixtures throws CapabilityError", async () => {
      await expect(adapter.getFixtures("premier-league")).rejects.toThrow(CapabilityError);
      await expect(adapter.getFixtures("premier-league")).rejects.toThrow(
        /does not support "fixtures"/,
      );
    });

    it("getMatch throws CapabilityError", async () => {
      await expect(adapter.getMatch("fix-001")).rejects.toThrow(CapabilityError);
      await expect(adapter.getMatch("fix-001")).rejects.toThrow(
        /does not support "results"/,
      );
    });

    it("getRecentMatches throws CapabilityError", async () => {
      await expect(adapter.getRecentMatches("team-001")).rejects.toThrow(CapabilityError);
      await expect(adapter.getRecentMatches("team-001")).rejects.toThrow(
        /does not support "recentForm"/,
      );
    });

    it("getHeadToHead throws CapabilityError", async () => {
      await expect(adapter.getHeadToHead("a", "b")).rejects.toThrow(CapabilityError);
      await expect(adapter.getHeadToHead("a", "b")).rejects.toThrow(
        /does not support "h2h"/,
      );
    });

    it("getSquad throws CapabilityError", async () => {
      await expect(adapter.getSquad("team-001")).rejects.toThrow(CapabilityError);
      await expect(adapter.getSquad("team-001")).rejects.toThrow(
        /does not support "squads"/,
      );
    });

    it("getLineup throws CapabilityError", async () => {
      await expect(adapter.getLineup("fix-001", "team-001")).rejects.toThrow(CapabilityError);
      await expect(adapter.getLineup("fix-001", "team-001")).rejects.toThrow(
        /does not support "lineups"/,
      );
    });

    it("getPlayerStats throws CapabilityError", async () => {
      await expect(adapter.getPlayerStats("player-001")).rejects.toThrow(CapabilityError);
      await expect(adapter.getPlayerStats("player-001")).rejects.toThrow(
        /does not support "playerStats"/,
      );
    });

    it("CapabilityError includes the provider id and method name", async () => {
      try {
        await adapter.getFixtures("premier-league");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CapabilityError);
        const capErr = err as CapabilityError;
        expect(capErr.providerId).toBe("adapter-strict-empty");
        expect(capErr.method).toBe("getFixtures");
        expect(capErr.capability).toBe("fixtures");
      }
    });

    it("getProviderStatus does NOT throw even in strict mode", async () => {
      const status = await adapter.getProviderStatus();
      expect(status.status).toBeDefined();
      expect(status.capabilities).toBeDefined();
    });
  });
});

describe("ProviderHealthStatus structure validation", () => {
  it("contains all required fields with correct types", () => {
    const status: ProviderHealthStatus = {
      status: "healthy",
      lastSync: "2026-05-06T10:00:00Z",
      errorCount: 0,
      lastError: null,
      capabilities: ALL_CAPABILITIES_ENABLED,
      freshness: "2m ago",
    };
    expect(typeof status.status).toBe("string");
    expect(typeof status.lastSync).toBe("string");
    expect(typeof status.errorCount).toBe("number");
    expect(status.lastError).toBeNull();
    expect(typeof status.freshness).toBe("string");
  });

  it("accepts all three status values", () => {
    const healthy: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      status: "healthy",
    };
    const degraded: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      status: "degraded",
    };
    const down: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      status: "down",
    };
    expect(healthy.status).toBe("healthy");
    expect(degraded.status).toBe("degraded");
    expect(down.status).toBe("down");
  });

  it("allows lastSync to be null (never synced)", () => {
    const status: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      lastSync: null,
    };
    expect(status.lastSync).toBeNull();
  });

  it("allows lastError to be a string or null", () => {
    const withError: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      lastError: "HTTP 503: Service Unavailable",
      errorCount: 3,
    };
    expect(withError.lastError).toBe("HTTP 503: Service Unavailable");
    expect(withError.errorCount).toBe(3);

    const noError: ProviderHealthStatus = {
      ...MOCK_HEALTH_STATUS,
      lastError: null,
      errorCount: 0,
    };
    expect(noError.lastError).toBeNull();
  });

  it("embeds a valid capabilities matrix", () => {
    const status = MOCK_HEALTH_STATUS;
    expectCapabilities(status.capabilities);
  });

  it("includes a human-readable freshness string", () => {
    const cases = ["2m ago", "stale", "never", "15s ago", "1h ago"];
    for (const freshness of cases) {
      const status: ProviderHealthStatus = { ...MOCK_HEALTH_STATUS, freshness };
      expect(typeof status.freshness).toBe("string");
      expect(status.freshness.length).toBeGreaterThan(0);
    }
  });

  it("ContractAdapter default fetchProviderStatus returns valid structure", async () => {
    const adapter = new FullContractAdapter();
    const status = await adapter.getProviderStatus();
    expect(["healthy", "degraded", "down"]).toContain(status.status);
    expect(typeof status.errorCount).toBe("number");
    expect(typeof status.freshness).toBe("string");
    expectCapabilities(status.capabilities);
  });
});

describe("Fixture interface completeness", () => {
  it("requires all mandatory fields", () => {
    const fixture: Fixture = {
      id: "fix-001",
      homeTeam: "Manchester Red",
      awayTeam: "Shanghai Harbor",
      kickoff: "2026-05-10T15:00:00Z",
      status: "scheduled",
      league: "premier-league",
    };
    expect(fixture.id).toBe("fix-001");
    expect(fixture.homeTeam).toBe("Manchester Red");
    expect(fixture.awayTeam).toBe("Shanghai Harbor");
    expect(fixture.kickoff).toBe("2026-05-10T15:00:00Z");
    expect(fixture.status).toBe("scheduled");
    expect(fixture.league).toBe("premier-league");
  });

  it("supports optional venue, referee, and season", () => {
    const withOptionals: Fixture = {
      ...MOCK_FIXTURE,
      venue: "Red Arena",
      referee: "A. Official",
      season: "2025-26",
    };
    expect(withOptionals.venue).toBe("Red Arena");
    expect(withOptionals.referee).toBe("A. Official");
    expect(withOptionals.season).toBe("2025-26");

    const withoutOptionals: Fixture = {
      id: "fix-002",
      homeTeam: "Team A",
      awayTeam: "Team B",
      kickoff: "2026-05-10T15:00:00Z",
      status: "live",
      league: "la-liga",
    };
    expect(withoutOptionals.venue).toBeUndefined();
    expect(withoutOptionals.referee).toBeUndefined();
    expect(withoutOptionals.season).toBeUndefined();
  });

  it("accepts all valid MatchStatus values", () => {
    for (const status of ["scheduled", "live", "finished"] as const) {
      const fixture: Fixture = { ...MOCK_FIXTURE, status };
      expect(fixture.status).toBe(status);
    }
  });
});

describe("MatchDetail interface completeness", () => {
  it("extends Fixture with score and event fields", () => {
    const detail: MatchDetail = MOCK_MATCH_DETAIL;
    // Inherited from Fixture
    expect(typeof detail.id).toBe("string");
    expect(typeof detail.homeTeam).toBe("string");
    expect(typeof detail.awayTeam).toBe("string");
    expect(typeof detail.kickoff).toBe("string");
    expect(typeof detail.status).toBe("string");
    expect(typeof detail.league).toBe("string");
    // MatchDetail-specific
    expect(typeof detail.homeScore).toBe("number");
    expect(typeof detail.awayScore).toBe("number");
    expect(Array.isArray(detail.events)).toBe(true);
  });

  it("supports optional stats and lineups", () => {
    const withOptionals: MatchDetail = MOCK_MATCH_DETAIL;
    expect(withOptionals.stats).toBeDefined();
    expect(typeof withOptionals.stats!.homePossession).toBe("number");
    expect(withOptionals.homeLineup).toBeDefined();
    expect(withOptionals.awayLineup).toBeDefined();
    expect(typeof withOptionals.homeLineup!.formation).toBe("string");

    const withoutOptionals: MatchDetail = {
      id: "fix-min",
      homeTeam: "A",
      awayTeam: "B",
      kickoff: "2026-01-01T00:00:00Z",
      status: "scheduled",
      league: "test",
      events: [],
    };
    expect(withoutOptionals.homeScore).toBeUndefined();
    expect(withoutOptionals.awayScore).toBeUndefined();
    expect(withoutOptionals.stats).toBeUndefined();
    expect(withoutOptionals.homeLineup).toBeUndefined();
    expect(withoutOptionals.awayLineup).toBeUndefined();
  });

  it("events array can contain typed match events", () => {
    const event: MatchEvent = MOCK_MATCH_EVENT;
    expect(typeof event.minute).toBe("number");
    expect(["goal", "ownGoal", "penalty", "yellowCard", "redCard", "substitution", "var"]).toContain(event.type);
    expect(["home", "away"]).toContain(event.team);
    expect(typeof event.player).toBe("string");
  });
});

describe("H2HResult interface completeness", () => {
  it("requires all mandatory numeric and array fields", () => {
    const h2h: H2HResult = MOCK_H2H;
    expect(typeof h2h.totalMatches).toBe("number");
    expect(typeof h2h.teamAWins).toBe("number");
    expect(typeof h2h.draws).toBe("number");
    expect(typeof h2h.teamBWins).toBe("number");
    expect(Array.isArray(h2h.lastMeetings)).toBe(true);
  });

  it("totalMatches equals the sum of wins and draws", () => {
    const h2h = MOCK_H2H;
    expect(h2h.totalMatches).toBe(h2h.teamAWins + h2h.draws + h2h.teamBWins);
  });

  it("lastMeetings contains MatchResult-shaped entries", () => {
    const meeting = MOCK_H2H.lastMeetings[0]!;
    expect(typeof meeting.matchId).toBe("string");
    expect(typeof meeting.date).toBe("string");
    expect(typeof meeting.opponent).toBe("string");
    expect(typeof meeting.isHome).toBe("boolean");
    expect(typeof meeting.goalsFor).toBe("number");
    expect(typeof meeting.goalsAgainst).toBe("number");
    expect(["W", "D", "L"]).toContain(meeting.result);
  });

  it("allows empty H2H (no meetings)", () => {
    const empty: H2HResult = {
      totalMatches: 0,
      teamAWins: 0,
      draws: 0,
      teamBWins: 0,
      lastMeetings: [],
    };
    expect(empty.totalMatches).toBe(0);
    expect(empty.lastMeetings).toHaveLength(0);
  });
});

describe("SquadPlayer interface completeness", () => {
  it("requires all mandatory fields", () => {
    const player: SquadPlayer = MOCK_SQUAD_PLAYER;
    expect(typeof player.playerId).toBe("string");
    expect(typeof player.name).toBe("string");
    expect(typeof player.position).toBe("string");
    expect(typeof player.injured).toBe("boolean");
  });

  it("supports optional number, nationality, age, and injuryNote", () => {
    const withOptionals: SquadPlayer = MOCK_SQUAD_PLAYER_INJURED;
    expect(typeof withOptionals.number).toBe("number");
    expect(typeof withOptionals.injured).toBe("boolean");
    expect(withOptionals.injured).toBe(true);
    expect(typeof withOptionals.injuryNote).toBe("string");

    const minimal: SquadPlayer = {
      playerId: "sp-min",
      name: "Test Player",
      position: "Defender",
      injured: false,
    };
    expect(minimal.number).toBeUndefined();
    expect(minimal.nationality).toBeUndefined();
    expect(minimal.age).toBeUndefined();
    expect(minimal.injuryNote).toBeUndefined();
  });
});

describe("LineupInfo interface completeness", () => {
  it("requires formation, starters, and substitutes", () => {
    const lineup: LineupInfo = MOCK_LINEUP;
    expect(typeof lineup.formation).toBe("string");
    expect(Array.isArray(lineup.starters)).toBe(true);
    expect(Array.isArray(lineup.substitutes)).toBe(true);
  });

  it("supports optional coach field", () => {
    const withCoach: LineupInfo = MOCK_LINEUP;
    expect(typeof withCoach.coach).toBe("string");

    const withoutCoach: LineupInfo = {
      formation: "3-5-2",
      starters: [],
      substitutes: [],
    };
    expect(withoutCoach.coach).toBeUndefined();
  });

  it("starters and substitutes contain SquadPlayer-shaped entries", () => {
    const lineup = MOCK_LINEUP;
    for (const player of [...lineup.starters, ...lineup.substitutes]) {
      expect(typeof player.playerId).toBe("string");
      expect(typeof player.name).toBe("string");
      expect(typeof player.position).toBe("string");
      expect(typeof player.injured).toBe("boolean");
    }
  });
});

describe("PlayerStats interface completeness", () => {
  it("requires all mandatory numeric fields", () => {
    const stats: PlayerStats = MOCK_PLAYER_STATS;
    expect(typeof stats.appearances).toBe("number");
    expect(typeof stats.goals).toBe("number");
    expect(typeof stats.assists).toBe("number");
    expect(typeof stats.yellowCards).toBe("number");
    expect(typeof stats.redCards).toBe("number");
    expect(typeof stats.minutesPlayed).toBe("number");
  });

  it("supports optional xG, xA, and rating fields", () => {
    const withOptionals: PlayerStats = MOCK_PLAYER_STATS;
    expect(typeof withOptionals.xG).toBe("number");
    expect(typeof withOptionals.xA).toBe("number");
    expect(typeof withOptionals.rating).toBe("number");

    const minimal: PlayerStats = {
      appearances: 10,
      goals: 2,
      assists: 1,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 720,
    };
    expect(minimal.xG).toBeUndefined();
    expect(minimal.xA).toBeUndefined();
    expect(minimal.rating).toBeUndefined();
  });

  it("allows zero-value stats (bench player)", () => {
    const bench: PlayerStats = {
      appearances: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0,
    };
    expect(bench.appearances).toBe(0);
    expect(bench.goals).toBe(0);
    expect(bench.minutesPlayed).toBe(0);
  });
});
