// @lineupcast/providers — data source adapters for open football data

export type { DataProvider } from "./data-provider.js";
export { MockProvider } from "./mock-provider.js";
export {
  OpenFootballProvider,
  StatsBombProvider,
  FootballDataOrgProvider,
  SportmonksProvider,
  ApiFootballProvider,
} from "./adapters.js";
export { CsvProvider } from "./csvProvider.js";
export type {
  CsvProviderData,
  CsvLineupRow,
  CsvPlayerStatsRow,
  CsvMatchHistoryRow,
} from "./csvProvider.js";
export { TheSportsProvider } from "./theSportsProvider.js";
export { SportmonksProvider as SportmonksScaffoldProvider } from "./sportmonksProvider.js";
export { ApiFootballScaffoldProvider } from "./apiFootballProvider.js";
export {
  getProvider,
  getProviderByType,
  listProviders,
  listReadyProviders,
  registerProvider,
  getFreshnessTracker,
  getProviderFreshness,
  getAllProviderFreshness,
  listProvidersByCapability,
  isProviderReady,
  // Health tracking
  recordProviderSuccess,
  recordProviderError,
  getProviderHealth,
  getAllProviderHealth,
  isProviderHealthy,
  // Fallback chain
  getProviderWithFallback,
} from "./registry.js";
export type { ProviderHealth, ProviderHealthEntry } from "./registry.js";
export {
  RateLimiter,
  FOOTBALL_DATA_ORG_LIMITER,
  API_FOOTBALL_LIMITER,
  OPEN_FOOTBALL_LIMITER,
} from "./rate-limiter.js";
export { FreshnessTracker } from "./freshness.js";
export type { ProviderFreshnessData } from "./freshness.js";

// ─── Unified contract ────────────────────────────────────────────────
export type {
  FootballDataProvider,
  ProviderCapabilities,
  Fixture,
  MatchDetail,
  MatchEvent,
  MatchStatistics,
  MatchResult,
  H2HResult,
  SquadPlayer,
  LineupInfo,
  PlayerStats,
  ProviderHealthStatus,
} from "./contracts.js";
export { ContractAdapter, CapabilityError } from "./contract-adapter.js";
