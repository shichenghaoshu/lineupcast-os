# Provider Adapter Guide

LineupCast OS uses a pluggable data-source system. Each provider implements the `DataProvider` interface and maps external data into the shared `@lineupcast/schema` types.

## Architecture

```
packages/schema      — shared TypeScript types (Match, Team, Player, etc.)
packages/providers   — DataProvider interface, built-in adapters, registry
```

Providers are registered at startup via `registerProvider()` and resolved by id at runtime via `getProvider(id)`.

## Adding a New Data Source

1. **Create a class** in `packages/providers/src/` that implements `DataProvider`:

```typescript
import type { DataProvider } from "./data-provider.js";
import type { Provider, Match, Team } from "@lineupcast/schema";

export class MySourceProvider implements DataProvider {
  readonly id = "my-source";
  readonly meta: Provider = {
    id: "my-source",
    name: "My Source",
    description: "What this provider offers.",
    requiresApiKey: true,
    tokenConfigured: !!process.env["MY_SOURCE_TOKEN"],
  };

  async fetchUpcomingMatches(league: string): Promise<Match[]> {
    // Call external API, map response via field mappings, return Match[]
  }
  // ... implement remaining methods
}
```

2. **Register it** in `packages/providers/src/registry.ts`:

```typescript
import { MySourceProvider } from "./my-source-provider.js";
register(new MySourceProvider());
```

3. **Add tests** in `packages/providers/src/__tests__/`.

## Field Mapping

External APIs use different field names. Use `FieldMapping` from `@lineupcast/schema` and the `applyFieldMappings()` utility to convert raw API responses:

```typescript
import { applyFieldMappings } from "@lineupcast/schema";

const mappings: FieldMapping[] = [
  { sourceField: "strPlayer", targetField: "name" },
  { sourceField: "strPosition", targetField: "position", transform: "toUpperCase" },
  { sourceField: "dateBorn", targetField: "dateOfBirth", transform: "iso8601" },
  { sourceField: "missing", targetField: "rating", fallback: 50 },
];

const player = applyFieldMappings(rawApiResponse, mappings);
```

Available transforms: `toUpperCase`, `toLowerCase`, `toNumber`, `toBoolean`, `toDate`, `splitComma`, `trim`, `iso8601`.

## API Key Configuration

Providers that require authentication read tokens from environment variables:

| Provider            | Env Variable             |
|---------------------|--------------------------|
| football-data.org   | `FOOTBALL_DATA_ORG_TOKEN`|
| Sportmonks          | `SPORTMONKS_API_TOKEN`   |
| API-FOOTBALL        | `API_FOOTBALL_KEY`       |

Set these in your `.env` file (never committed):

```bash
# .env — local only, listed in .gitignore
FOOTBALL_DATA_ORG_TOKEN=your_token_here
```

The `Provider.meta.tokenConfigured` boolean is safe to expose — it only indicates whether the env var is set, never the actual value.

## Security: Never Commit Tokens

- `.env` is in `.gitignore` — never remove it.
- `.env.example` documents required variable names with placeholder values only.
- CI/CD systems should inject secrets at runtime, not store them in repo files.
- `Provider.meta.tokenConfigured` is a boolean, not a secret.

## Open vs. Commercial Data

| Source             | License                  | API Key Required |
|--------------------|--------------------------|------------------|
| OpenFootball       | Public domain (GitHub)   | No               |
| StatsBomb Open Data| Free for research        | No               |
| football-data.org  | Free tier available      | Yes              |
| Sportmonks         | Commercial               | Yes              |
| API-FOOTBALL       | Freemium (RapidAPI)      | Yes              |

**Commercial data licensing**: If you use Sportmonks, API-FOOTBALL, or any paid data source, you are responsible for complying with that provider's terms of service and licensing. LineupCast OS does not redistribute commercial data — it only reads from APIs you configure.

## Provider Status

Call `listProviders()` to get metadata for all registered providers (safe to display in UI):

```typescript
import { listProviders, listReadyProviders } from "@lineupcast/providers";

const all = listProviders();        // all providers
const ready = listReadyProviders(); // only those with tokens set or free APIs
```
