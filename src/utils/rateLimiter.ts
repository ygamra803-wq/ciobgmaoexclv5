/**
 * Simple client-side rate limiter for sensitive actions (e.g. PIN attempts, API syncs)
 */
export class RateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private attempts: Map<string, { count: number; startTime: number }>;

  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now - record.startTime > this.windowMs) {
      this.attempts.set(key, { count: 1, startTime: now });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count += 1;
    return true;
  }

  reset(key) {
    this.attempts.delete(key);
  }
}
