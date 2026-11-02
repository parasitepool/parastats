export const STRATUM_MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Capped exponential backoff with a small amount of jitter.
 * Retries never stop, but the delay settles at 30 seconds.
 */
export function getStratumReconnectDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.min(Math.max(attempt, 0), 5);
  const base = Math.min(1000 * 2 ** exponent, STRATUM_MAX_RECONNECT_DELAY_MS);
  const jitter = Math.floor(random() * 0.2 * base);

  return Math.min(base + jitter, STRATUM_MAX_RECONNECT_DELAY_MS);
}
