/**
 * Retry an async operation with exponential backoff.
 * Retries on any thrown error. Gives up after maxAttempts total tries.
 *
 * Example: withRetry(() => fetch(...), 3, 1000)
 * Attempts at: 0ms, 1000ms, 2000ms
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
