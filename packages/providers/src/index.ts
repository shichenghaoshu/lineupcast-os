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
export {
  getProvider,
  listProviders,
  listReadyProviders,
  registerProvider,
} from "./registry.js";
export {
  RateLimiter,
  FOOTBALL_DATA_ORG_LIMITER,
  API_FOOTBALL_LIMITER,
  OPEN_FOOTBALL_LIMITER,
} from "./rate-limiter.js";
