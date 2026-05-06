// @lineupcast/providers — provider registry and status lookup

import type { Provider } from "@lineupcast/schema";
import type { DataProvider } from "./data-provider.js";
import { MockProvider } from "./mock-provider.js";
import {
  OpenFootballProvider,
  StatsBombProvider,
  FootballDataOrgProvider,
  SportmonksProvider,
  ApiFootballProvider,
} from "./adapters.js";

/** All registered provider instances */
const providers: Map<string, DataProvider> = new Map();

function register(provider: DataProvider): void {
  providers.set(provider.id, provider);
}

// Register built-in providers
register(new MockProvider());
register(new OpenFootballProvider());
register(new StatsBombProvider());
register(new FootballDataOrgProvider());
register(new SportmonksProvider());
register(new ApiFootballProvider());

/** Get a provider by id. Throws if not found. */
export function getProvider(id: string): DataProvider {
  const p = providers.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}

/** List all registered provider metadata (safe — no token values) */
export function listProviders(): Provider[] {
  return Array.from(providers.values()).map((p) => p.meta);
}

/** List only providers that are ready to use (token present or not required) */
export function listReadyProviders(): Provider[] {
  return listProviders().filter((p) => !p.requiresApiKey || p.tokenConfigured);
}

/** Register a custom provider at runtime */
export function registerProvider(provider: DataProvider): void {
  register(provider);
}
