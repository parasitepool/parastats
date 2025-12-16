/**
 * Shared types for highest-diff API routes
 */

// Constants
export const MAX_LIMIT = 500;
export const MAX_BLOCK_HEIGHT = 2_000_000; // Upper bound for block height validation
export const MAX_USERS_PER_BLOCK = 1000; // Limit for user diffs query

// Database row types
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

// API response types
export interface FormattedBlockWinner {
  block_height: number;
  winner_address: string;
  fullAddress: string;
  difficulty: number;
  block_timestamp: number | null;
}

export interface FormattedUserWinCount {
  address: string;
  fullAddress: string;
  win_count: number;
  total_diff: number;
  avg_diff: number;
}

export interface FormattedUserDiff {
  block_height: number;
  difficulty: number;
  block_timestamp: number | null;
  address: string;
  fullAddress: string;
}

export interface BlockLeaderboardResponse {
  block_height: number;
  block_timestamp: number | null;
  winner: {
    address: string;
    fullAddress: string;
    difficulty: number;
  };
  users: {
    address: string;
    fullAddress: string;
    difficulty: number;
  }[];
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

