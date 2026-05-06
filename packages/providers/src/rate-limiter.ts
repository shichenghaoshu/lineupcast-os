/** Token-bucket rate limiter for provider API calls. */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number,
    private readonly refillIntervalMs: number = 60_000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs) * this.refillRate;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/** Pre-configured rate limiters for each provider. */
export const FOOTBALL_DATA_ORG_LIMITER = new RateLimiter(10, 10, 60_000);
export const API_FOOTBALL_LIMITER = new RateLimiter(10, 10, 60_000);
export const OPEN_FOOTBALL_LIMITER = new RateLimiter(30, 30, 60_000);
