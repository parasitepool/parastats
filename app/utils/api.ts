import mempoolJS from "@mempool/mempool.js";
import { Hashrate, Adjustment } from "@mempool/mempool.js/lib/interfaces/bitcoin/difficulty";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import { ProcessedUserData } from "../api/user/[address]/route";
import { HistoricalPoolStats } from "../api/pool-stats/historical/route";
import { HistoricalUserStats } from "../api/user/[address]/historical/route";

// Initialize mempoolJS
const { bitcoin } = mempoolJS();
const { difficulty, blocks } = bitcoin;

export type PoolStats = {
  uptime: string;
  lastBlockTime: string;
  highestDifficulty: string;
  hashrate: number;
  users: number;
  workers: number;
}

// Helper function to create a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper function for API calls
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 500
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await delay(baseDelay * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Hashrate and difficulty APIs
export async function getHashrate(interval = "1m"): Promise<Hashrate> {
  try {
    return await withRetry(() => difficulty.getHashrate({ interval }));
  } catch (error) {
    console.error("Error fetching hashrate:", error);
    throw error;
  }
}

export async function getDifficultyAdjustment(): Promise<Adjustment> {
  try {
    return await withRetry(() => difficulty.getDifficultyAdjustment());
  } catch (error) {
    console.error("Error fetching difficulty adjustment:", error);
    throw error;
  }
}

// Blocks APIs
export async function getBlocksTipHeight(): Promise<number> {
  try {
    return await withRetry(() => blocks.getBlocksTipHeight());
  } catch (error) {
    console.error("Error fetching blocks tip height:", error);
    throw error;
  }
}

export async function getRecentBlocks(tipHeight: number): Promise<Block[]> {
  try {
    return await withRetry(() => blocks.getBlocks({
      start_height: tipHeight,
    }));
  } catch (error) {
    console.error("Error fetching recent blocks:", error);
    throw error;
  }
}

// Bitcoin price API
export async function getBitcoinPrice(): Promise<number | null> {
  try {
    return await withRetry(async () => {
      const response = await fetch("https://mempool.space/api/v1/prices");
      const data = await response.json();
      return data.USD;
    });
  } catch (error) {
    console.error("Error fetching Bitcoin price:", error);
    return null;
  }
}

// Pool stats API
export async function getPoolStats(): Promise<PoolStats> {
  try {
    return await withRetry(async () => {
      const response = await fetch("/api/pool-stats");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    throw error;
  }
}

// User data API
export async function getUserData(address: string): Promise<ProcessedUserData> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/user/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error(`Error fetching data for user ${address}:`, error);
    throw error;
  }
}

// Historical pool stats API
export async function getHistoricalPoolStats(period: string = "24h", interval: string = "5m"): Promise<HistoricalPoolStats[]> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/pool-stats/historical?period=${period}&interval=${interval}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error("Error fetching historical pool stats:", error);
    throw error;
  }
}

// Historical user stats API
export async function getHistoricalUserStats(address: string, period: string = "24h", interval: string = "5m"): Promise<HistoricalUserStats[]> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/user/${address}/historical?period=${period}&interval=${interval}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error(`Error fetching historical stats for user ${address}:`, error);
    throw error;
  }
}

// Toggle user visibility API
export async function toggleUserVisibility(address: string): Promise<{ isPublic: boolean }> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/user/${address}`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error(`Error toggling visibility for user ${address}:`, error);
    throw error;
  }
}

// Highest diff types
export interface BlockWinner {
  block_height: number;
  winner_address: string;
  fullAddress: string;
  difficulty: number;
  collected_at: number;
}

export interface UserWinCount {
  address: string;
  fullAddress: string;
  win_count: number;
  total_diff: number;
  avg_diff: number;
}

export interface UserBlockDiff {
  block_height: number;
  address: string;
  fullAddress: string;
  difficulty: number;
}

// Recent block winners API
export async function getRecentBlockWinners(limit: number = 10): Promise<BlockWinner[]> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/highest-diff?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error("Error fetching recent block winners:", error);
    throw error;
  }
}

// Block winners leaderboard API
export async function getBlockWinnersLeaderboard(limit: number = 99): Promise<UserWinCount[]> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/highest-diff?type=winners&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error("Error fetching block winners leaderboard:", error);
    throw error;
  }
}

// User's block wins API
export async function getUserBlockWins(address: string, limit: number = 50): Promise<BlockWinner[]> {
  try {
    return await withRetry(async () => {
      const response = await fetch(`/api/highest-diff?address=${address}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    });
  } catch (error) {
    console.error(`Error fetching block wins for user ${address}:`, error);
    throw error;
  }
}

// Trigger collection for missing blocks
export async function triggerBlockCollection(blockHeights: number[]): Promise<void> {
  if (blockHeights.length === 0) return;
  
  try {
    const blocks = blockHeights.slice(0, 5).join(',');
    await fetch(`/api/highest-diff?blocks=${blocks}`, {
      method: 'POST',
    });
  } catch (error) {
    // Silently fail - this is a background operation
    console.debug('Error triggering block collection:', error);
  }
}
