/**
 * Simple in-memory rate limiter.
 * Resets per window — good enough for a single Vercel instance.
 * For multi-region, swap the Map for a Redis/Upstash store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request should be allowed, false if rate limited.
 * @param key      Unique key, e.g. `analyze:user-uuid`
 * @param limit    Max requests allowed per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
