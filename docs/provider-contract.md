# Provider Contract Documentation

> For commentary assistance, not betting advice.

This document defines the `FootballDataProvider` interface, how to implement new providers, the capability matrix, and health status definitions.

---

## Table of Contents

1. [Provider Interface](#provider-interface)
2. [How to Add a New Provider](#how-to-add-a-new-provider)
3. [Capability Matrix](#capability-matrix)
4. [Health Status Definitions](#health-status-definitions)
5. [Examples](#examples)
6. [Troubleshooting](#troubleshooting)

---

## Provider Interface

Every data provider in LineupCast OS implements the `FootballDataProvider` contract. This contract defines what data a provider can supply and how it reports its own health and capabilities.

### Core Interface

```typescript
interface FootballDataProvider {
  /** Unique provider identifier, e.g. "football-data-org", "csv-import" */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** List of capabilities this provider supports */
  readonly capabilities: ProviderCapability[];

  /** Current health and freshness status */
  getHealthStatus(): Promise<ProviderHealthStatus>;

  /** Fetch upcoming fixtures for a competition */
  getFixtures(competitionId: string, options?: FixtureOptions): Promise<Fixture[]>;

  /** Fetch detailed match data for a specific match */
  getMatchDetail(matchId: string): Promise<MatchDetail | null>;

  /** Fetch recent matches for a team */
  getRecentMatches(teamId: string, limit?: number): Promise<MatchSummary[]>;

  /** Fetch league standings */
  getStandings(competitionId: string): Promise<Standing[]>;

  /** Fetch head-to-head record between two teams */
  getHeadToHead(homeTeamId: string, awayTeamId: string): Promise<H2HRecord | null>;

  /** Fetch squad/lineup information */
  getSquad(teamId: string): Promise<Player[]>;

  /** Fetch player-level statistics */
  getPlayerStats(playerId: string): Promise<PlayerStats | null>;
}
```

### Provider Capability Enum

```typescript
enum ProviderCapability {
  FIXTURES = "fixtures",
  MATCH_DETAIL = "match_detail",
  RECENT_MATCHES = "recent_matches",
  STANDINGS = "standings",
  HEAD_TO_HEAD = "head_to_head",
  SQUAD = "squad",
  PLAYER_STATS = "player_stats",
  LIVE_SCORES = "live_scores",
  XG_DATA = "xg_data",
}
```

### Health Status

```typescript
interface ProviderHealthStatus {
  /** Provider identifier */
  providerId: string;

  /** Overall status */
  status: "healthy" | "degraded" | "unreachable" | "unconfigured";

  /** ISO timestamp of last successful API call */
  lastSuccessfulCall: string | null;

  /** ISO timestamp of last failed API call */
  lastFailedCall: string | null;

  /** Error message from last failure, if any */
  lastError: string | null;

  /** Average response time in milliseconds (rolling window) */
  avgResponseTimeMs: number | null;

  /** Percentage of successful calls in the last hour */
  successRate1h: number | null;

  /** List of capabilities currently available */
  availableCapabilities: ProviderCapability[];

  /** List of capabilities that are degraded or failing */
  degradedCapabilities: ProviderCapability[];
}
```

### Data Freshness

Each provider tracks freshness metadata:

```typescript
interface DataFreshness {
  /** ISO timestamp of the data snapshot */
  fetchedAt: string;

  /** How old the data is in seconds */
  ageSeconds: number;

  /** Whether the data is considered stale (> 1 hour for live, > 24 hours for historical) */
  isStale: boolean;

  /** Provider that supplied this data */
  sourceProviderId: string;
}
```

---

## How to Add a New Provider

Follow these steps to implement a new data provider.

### Step 1: Create the Provider Class

Create a new file in `packages/providers/src/`:

```typescript
// packages/providers/src/my-provider.ts

import { FootballDataProvider, ProviderCapability } from "./contract";

export class MyProvider implements FootballDataProvider {
  readonly id = "my-provider";
  readonly name = "My Football Data Provider";
  readonly capabilities = [
    ProviderCapability.FIXTURES,
    ProviderCapability.MATCH_DETAIL,
    ProviderCapability.RECENT_MATCHES,
    ProviderCapability.STANDINGS,
  ];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getHealthStatus() {
    try {
      // Make a lightweight API call to verify connectivity
      const response = await fetch(`${this.baseUrl}/status`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return {
          providerId: this.id,
          status: "degraded" as const,
          lastSuccessfulCall: null,
          lastFailedCall: new Date().toISOString(),
          lastError: `HTTP ${response.status}`,
          avgResponseTimeMs: null,
          successRate1h: null,
          availableCapabilities: [],
          degradedCapabilities: this.capabilities,
        };
      }

      return {
        providerId: this.id,
        status: "healthy" as const,
        lastSuccessfulCall: new Date().toISOString(),
        lastFailedCall: null,
        lastError: null,
        avgResponseTimeMs: null,
        successRate1h: 1.0,
        availableCapabilities: this.capabilities,
        degradedCapabilities: [],
      };
    } catch (error) {
      return {
        providerId: this.id,
        status: "unreachable" as const,
        lastSuccessfulCall: null,
        lastFailedCall: new Date().toISOString(),
        lastError: String(error),
        avgResponseTimeMs: null,
        successRate1h: null,
        availableCapabilities: [],
        degradedCapabilities: this.capabilities,
      };
    }
  }

  async getFixtures(competitionId: string, options?: any) {
    // Implement fixture fetching
    throw new Error("Not implemented");
  }

  async getMatchDetail(matchId: string) {
    // Implement match detail fetching
    throw new Error("Not implemented");
  }

  async getRecentMatches(teamId: string, limit?: number) {
    // Implement recent matches fetching
    throw new Error("Not implemented");
  }

  async getStandings(competitionId: string) {
    // Implement standings fetching
    throw new Error("Not implemented");
  }

  async getHeadToHead(homeTeamId: string, awayTeamId: string) {
    // Not supported by this provider
    return null;
  }

  async getSquad(teamId: string) {
    // Not supported by this provider
    throw new Error("Not implemented");
  }

  async getPlayerStats(playerId: string) {
    // Not supported by this provider
    return null;
  }
}
```

### Step 2: Register the Provider

Add the provider to the provider registry:

```typescript
// packages/providers/src/registry.ts

import { MyProvider } from "./my-provider";

export function createProviders(config: ProviderConfig): FootballDataProvider[] {
  const providers: FootballDataProvider[] = [];

  // Existing providers...
  if (config.footballDataApiKey) {
    providers.push(new FootballDataOrgProvider(config.footballDataApiKey));
  }

  // New provider
  if (config.myProviderApiKey) {
    providers.push(new MyProvider(config.myProviderApiKey, config.myProviderBaseUrl));
  }

  return providers;
}
```

### Step 3: Add Configuration

Add environment variables to `.env.example`:

```bash
# My Provider
MY_PROVIDER_API_KEY=
MY_PROVIDER_BASE_URL=https://api.myprovider.com/v1
```

### Step 4: Add Tests

Create contract tests:

```typescript
// packages/providers/src/__tests__/my-provider.test.ts

import { describe, it, expect } from "vitest";
import { MyProvider } from "../my-provider";

describe("MyProvider", () => {
  it("reports correct capabilities", () => {
    const provider = new MyProvider("test-key", "https://api.test.com");
    expect(provider.capabilities).toContain("fixtures");
    expect(provider.id).toBe("my-provider");
  });

  it("returns unreachable status when API is down", async () => {
    const provider = new MyProvider("test-key", "https://invalid-url.test");
    const health = await provider.getHealthStatus();
    expect(health.status).toBe("unreachable");
  });
});
```

### Step 5: Document the Provider

Add a section to this document in the [Capability Matrix](#capability-matrix) below.

---

## Capability Matrix

The capability matrix shows which providers support which features. Use this to choose the right provider for your needs.

### Data Providers

| Capability         | MockProvider | football-data.org | CSV Import | OpenFootball | FBref (planned) |
| ------------------ | ------------ | ----------------- | ---------- | ------------ | --------------- |
| Fixtures           | Yes          | Yes               | --         | Yes          | Yes             |
| Match Detail       | Yes          | Yes               | --         | Partial      | Yes             |
| Recent Matches     | Yes          | Yes               | --         | Yes          | Yes             |
| Standings          | Yes          | Yes               | --         | Yes          | Yes             |
| Head-to-Head       | Yes          | Yes               | --         | Partial      | Yes             |
| Squad / Lineup     | Yes          | Partial           | Yes        | --           | Yes             |
| Player Stats       | Yes          | --                | Yes        | --           | Yes             |
| Live Scores        | --           | --                | --         | --           | --              |
| xG Data            | --           | --                | --         | --           | Yes             |

### LLM Providers

| Capability          | None  | OpenAI-Compatible | Hugging Face Endpoint |
| ------------------- | ----- | ----------------- | --------------------- |
| Script Generation   | --    | Yes               | Yes                   |
| Bilingual Output    | --    | Yes               | Yes                   |
| Structured JSON     | --    | Yes               | Partial               |
| Fallback Handling   | Yes   | Yes               | Yes                   |

### Provider Selection Logic

The system selects providers based on:

1. **Capability needed:** Which data is requested.
2. **Provider priority:** Configured order (real providers before mock).
3. **Health status:** Only healthy or degraded providers are used.
4. **Data completeness:** Providers with higher completeness scores are preferred.

```
Request for fixtures
  -> Check football-data.org (healthy, has FIXTURES capability) -> use it
  -> If unhealthy, check OpenFootball (healthy, has FIXTURES) -> use it
  -> If all real providers fail, fall back to MockProvider (if ALLOW_SYNTHETIC_DATA=true)
```

---

## Health Status Definitions

### Status Values

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `healthy` | Provider is responding normally. All capabilities available. Last call succeeded within expected latency. | None. |
| `degraded` | Provider is responding but with issues. Some capabilities may be unavailable. Last call succeeded but with elevated latency or partial data. | Monitor. Check provider-specific status page. |
| `unreachable` | Provider is not responding. Network timeout, DNS failure, or connection refused. | Check network, API key, and provider status page. |
| `unconfigured` | Provider has no API key or connection details configured. | Add configuration via `.env` or API Configuration Center. |

### Health Check Endpoint

```bash
GET /api/providers
```

Response:

```json
[
  {
    "id": "football-data-org",
    "name": "Football-Data.org",
    "status": "healthy",
    "lastSuccessfulCall": "2026-05-07T10:30:00Z",
    "lastFailedCall": null,
    "lastError": null,
    "avgResponseTimeMs": 245,
    "successRate1h": 0.98,
    "capabilities": ["fixtures", "match_detail", "recent_matches", "standings", "head_to_head"],
    "availableCapabilities": ["fixtures", "match_detail", "recent_matches", "standings", "head_to_head"],
    "degradedCapabilities": []
  }
]
```

### Readiness Endpoint

The `/readyz` endpoint includes provider freshness in its response:

```json
{
  "ready": true,
  "providers": {
    "football-data-org": {
      "status": "healthy",
      "lastFreshData": "2026-05-07T10:30:00Z",
      "stalenessSeconds": 120
    }
  }
}
```

### Freshness Thresholds

| Data Type | Fresh | Stale | Expired |
|-----------|-------|-------|---------|
| Fixtures | < 1 hour | 1-6 hours | > 6 hours |
| Match Detail | < 5 minutes | 5-30 minutes | > 30 minutes |
| Recent Matches | < 1 hour | 1-24 hours | > 24 hours |
| Standings | < 1 hour | 1-6 hours | > 6 hours |
| Player Stats | < 24 hours | 1-7 days | > 7 days |

---

## Examples

### Example: Query Provider Health

```bash
# List all providers and their status
curl http://localhost:8000/api/providers

# Filter for unhealthy providers
curl http://localhost:8000/api/providers | jq '.[] | select(.status != "healthy")'
```

### Example: Use a Specific Provider

```bash
# Force a specific provider for a request
curl http://localhost:8000/api/matches/demo-match-001/prediction \
  -H "X-Provider-Preference: football-data-org"
```

### Example: Check Data Completeness

```bash
# Get completeness score for a match
curl http://localhost:8000/api/matches/demo-match-001/prediction | jq '.completeness'
```

Response includes:

```json
{
  "score": 0.85,
  "confidenceCap": 0.9,
  "missingFields": ["player_xg", "referee_history"],
  "degradedMode": false
}
```

---

## Troubleshooting

### Provider Shows `unconfigured`

**Cause:** No API key set for this provider.

**Fix:** Add the key via `.env` or the API Configuration Center:

```bash
# Via .env
FOOTBALL_DATA_API_KEY=your_key

# Via API
curl -X PUT http://localhost:8000/api/config/provider/football-data \
  -H "X-Admin-Key: your-admin-key" \
  -d '{"api_key": "your_key"}'
```

### Provider Shows `unreachable`

**Cause:** Network issue, wrong URL, or provider service is down.

**Fix:**
1. Check the base URL in configuration.
2. Test connectivity: `curl https://api.football-data.org/v4/competitions -H "X-Auth-Token: your_key"`.
3. Check provider status page for outages.

### Provider Shows `degraded`

**Cause:** Some capabilities failing while others work.

**Fix:** Check `degradedCapabilities` in the health response. The provider may be rate-limited or experiencing partial outages.

### Prediction Uses Mock Data Instead of Real Provider

**Cause:** Real provider is unhealthy and `ALLOW_SYNTHETIC_DATA=true`.

**Fix:**
1. Check real provider health: `curl http://localhost:8000/api/providers`.
2. Fix the real provider issue.
3. To prevent mock fallback, set `ALLOW_SYNTHETIC_DATA=false`.

### Data Completeness Score is Low

**Cause:** Provider does not supply all fields needed for the prediction model.

**Fix:**
1. Check `missingFields` in the completeness response.
2. Add a supplementary provider (e.g., CSV import for player stats).
3. Accept degraded mode with lower confidence cap.

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
