// @lineupcast/providers — FreshnessTracker for per-provider sync metadata

export interface ProviderFreshnessData {
  lastSync?: string;
  freshness: string;
  errorCount: number;
  lastError?: string;
}

interface FreshnessEntry {
  lastSync: number | null;
  errorCount: number;
  lastError: string | null;
}

function formatFreshness(lastSyncMs: number | null): string {
  if (lastSyncMs === null) return "never";
  const elapsed = Date.now() - lastSyncMs;
  if (elapsed < 0) return "just now";
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Tracks per-provider sync timestamps, error counts, and last error messages.
 * Thread-safe for single-threaded Node.js event loop usage.
 */
export class FreshnessTracker {
  private entries = new Map<string, FreshnessEntry>();

  private getEntry(providerId: string): FreshnessEntry {
    let entry = this.entries.get(providerId);
    if (!entry) {
      entry = { lastSync: null, errorCount: 0, lastError: null };
      this.entries.set(providerId, entry);
    }
    return entry;
  }

  /** Record a successful sync for the given provider. */
  recordSync(providerId: string): void {
    const entry = this.getEntry(providerId);
    entry.lastSync = Date.now();
    entry.errorCount = 0;
    entry.lastError = null;
  }

  /** Record an error for the given provider. */
  recordError(providerId: string, message: string): void {
    const entry = this.getEntry(providerId);
    entry.errorCount += 1;
    entry.lastError = message;
  }

  /** Get freshness data for a single provider. */
  getFreshness(providerId: string): ProviderFreshnessData {
    const entry = this.getEntry(providerId);
    return {
      lastSync: entry.lastSync ? new Date(entry.lastSync).toISOString() : undefined,
      freshness: formatFreshness(entry.lastSync),
      errorCount: entry.errorCount,
      lastError: entry.lastError ?? undefined,
    };
  }

  /** Get freshness data for all tracked providers. */
  getAllFreshness(): Map<string, ProviderFreshnessData> {
    const result = new Map<string, ProviderFreshnessData>();
    for (const [id] of this.entries) {
      result.set(id, this.getFreshness(id));
    }
    return result;
  }

  /** Reset all tracking state. */
  reset(): void {
    this.entries.clear();
  }
}
