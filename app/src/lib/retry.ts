/**
 * Retry an async operation with exponential backoff.
 * Retries on any thrown error by default. Gives up after maxAttempts total tries.
 *
 * Example: withRetry(() => fetch(...), 3, 1000)
 * Attempts at: 0ms, 1000ms, 2000ms
 *
 * Pass isRetryable to skip retrying errors that will never succeed on their
 * own — auth failures, billing/quota errors, malformed requests. Retrying
 * those just burns attempts and delays the failure being surfaced. Defaults
 * to retrying everything so existing callers are unaffected.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
  isRetryable: (err: unknown) => boolean = () => true
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
