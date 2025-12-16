/**
 * Shared types for highest-diff API routes
 * 
 * PRIVACY NOTE: Full addresses are NEVER exposed in API responses.
 * Only truncated addresses are returned to protect user privacy.
 * 
 * TERMINOLOGY NOTE: We use "watermark" or "top diff" instead of "winner"
 * to avoid implying that users won anything. The highest difficulty share
 * is simply a watermark/high-water mark for that block.
 */

// Constants
export const MAX_LIMIT = 500;

/**
 * Upper bound for block height validation.
 * 
 * Purpose: Prevents resource exhaustion attacks where an attacker could
 * request extremely large block heights (e.g., Number.MAX_SAFE_INTEGER)
 * which could cause issues with parseInt, database queries, or memory.
 * 
 * 2 million is well beyond any foreseeable Bitcoin block height
 * (current height ~870k, ~144 blocks/day = ~52k blocks/year).
 * This gives ~20+ years of headroom.
 */
export const MAX_BLOCK_HEIGHT = 2_000_000;

export const MAX_USERS_PER_BLOCK = 1000; // Limit for user diffs query

// Database row types (internal use only)
// Note: Database columns use "top_diff_address" instead of "winner_address"
export interface BlockHighestDiffRow {
  block_height: number;
  top_diff_address: string;
  difficulty: number;
  block_timestamp: number | null;
}

export interface UserBlockDiffRow {
  address: string;
  difficulty: number;
}

export interface UserDiffCountRow {
  address: string;
  watermark_count: number;
  total_diff: number;
  avg_diff: number;
}

export interface UserDiffWithTimestampRow {
  block_height: number;
  address: string;
  difficulty: number;
  block_timestamp: number | null;
}

// API response types - only truncated addresses exposed
export interface FormattedBlockHighestDiff {
  block_height: number;
  top_diff_address: string; // Truncated address only
  difficulty: number;
  block_timestamp: number | null;
}

export interface FormattedUserDiffCount {
  address: string; // Truncated address only
  watermark_count: number;
  total_diff: number;
  avg_diff: number;
}

export interface FormattedUserDiff {
  block_height: number;
  difficulty: number;
  block_timestamp: number | null;
  address: string; // Truncated address only
}

export interface BlockLeaderboardUser {
  address: string; // Truncated address only
  difficulty: number;
}

export interface BlockLeaderboardResponse {
  block_height: number;
  block_timestamp: number | null;
  top_diff: {
    address: string; // Truncated address only
    difficulty: number;
  };
  users: BlockLeaderboardUser[];
  user_count: number;
}

/**
 * Structured error logging helper
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
}
