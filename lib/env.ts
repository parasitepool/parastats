/**
 * Parse an environment variable as a positive integer.
 *
 * Falls back for anything that isn't a finite integer > 0. Batch sizes and loop
 * strides are the main callers: a `0` stride loops forever and a `NaN` stride
 * skips the loop body entirely, so neither may ever reach the caller.
 */
export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`Ignoring invalid value "${raw}" for positive integer, using ${fallback}`);
    return fallback;
  }
  return parsed;
}
