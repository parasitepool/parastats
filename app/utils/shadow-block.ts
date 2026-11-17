export const SHADOW_BLOCK_WINDOW_SECONDS = 24 * 60 * 60;
// Safety cap: 24h is about 144 blocks, but blocks can arrive faster.
export const SHADOW_BLOCK_MAX_BLOCKS = 288;
export const SHADOW_BLOCK_POLL_INTERVAL_MS = 60 * 1000;

export interface ShadowBlockTopDiff {
  block_height: number;
  block_timestamp: number | null;
  top_diff_address: string | null;
  difficulty: number | null;
}

export interface ShadowBlockTopDiffShare extends ShadowBlockTopDiff {
  top_diff_address: string;
  difficulty: number;
}

export function isShadowBlockTopDiffShare(
  diff: ShadowBlockTopDiff,
): diff is ShadowBlockTopDiffShare {
  return diff.top_diff_address !== null && diff.difficulty !== null;
}

export function shadowBlockTopDiffSignature(diffs: ShadowBlockTopDiff[]): string {
  return diffs
    .map((diff) => `${diff.block_height}:${diff.top_diff_address ?? ''}:${diff.difficulty ?? ''}`)
    .join('|');
}

/**
 * Places every slot somewhere along the loop up front, with random spacing
 * between them. The gaps are exponential but never smaller than the effective
 * minimum, so the strip starts full while the spacing stays uneven.
 */
export function buildRandomDelays(count: number, durationMs: number, minGapMs: number): number[] {
  if (count <= 0 || durationMs <= 0) return [];

  // Leave room for every slot even on very narrow containers.
  const effectiveMinGap = Math.min(minGapMs, durationMs / (count + 1));
  const fixedTotal = effectiveMinGap * count;
  const slack = Math.max(0, durationMs - fixedTotal);
  const randomGaps = Array.from({ length: count }, () => -Math.log(1 - Math.random()));
  const randomTotal = randomGaps.reduce((sum, gap) => sum + gap, 0) || 1;
  let elapsed = 0;

  return randomGaps.map((gap) => {
    elapsed += effectiveMinGap + (gap / randomTotal) * slack;
    return Math.min(elapsed, durationMs);
  });
}

export function parseBlockParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || !/^\d+$/.test(raw)) return null;

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
