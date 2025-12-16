/**
 * Shared types for highest-diff API routes
 * 
 * PRIVACY NOTE: Full addresses are NEVER exposed in API responses.
 * Only truncated addresses are returned to protect user privacy.
 */

// Constants
export const MAX_LIMIT = 500;
export const MAX_BLOCK_HEIGHT = 2_000_000; // Upper bound for block height validation
export const MAX_USERS_PER_BLOCK = 1000; // Limit for user diffs query

// Database row types (internal use only)
export interface BlockWinnerRow {
  block_height: number;
  winner_address: string;
  difficulty: number;
  block_timestamp: number | null;
}

export interface UserBlockDiffRow {
  address: string;
  difficulty: number;
}

export interface UserWinCountRow {
  address: string;
  win_count: number;
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
export interface FormattedBlockWinner {
  block_height: number;
  winner_address: string; // Truncated address only
  difficulty: number;
  block_timestamp: number | null;
}

export interface FormattedUserWinCount {
  address: string; // Truncated address only
  win_count: number;
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
  winner: {
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
