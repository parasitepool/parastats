import cron from 'node-cron';
import { getDb } from './db';
import { fetch, HttpError, isRetryableError } from './http-client';

// Types for API responses
interface HighestDiffResponse {
  blockheight: number;
  username: string;
  diff: number;
}

interface UserDiffEntry {
  username: string;
  diff: number;
}

// Configuration
const CONFIG = {
  BACKFILL_BLOCKS: 432, // Number of blocks to backfill on startup (3 days worth: 3 * 144)
  MAX_BLOCKS_TO_KEEP: 432, // Only keep this many blocks in the database (3 days worth)
  COLLECTION_DELAY_MS: 60_000, // 1 minute delay after clean_jobs
  MEMPOOL_API_URL: 'https://mempool.space/api/blocks/tip/height',
  MEMPOOL_BLOCK_URL: 'https://mempool.space/api/block-height',
  MEMPOOL_BLOCK_DETAILS_URL: 'https://mempool.space/api/block',
  MAX_RETRIES: 4,
  RETRY_BASE_DELAY: 500,
} as const;

let isCollecting = false;
let pendingCollections: Map<number, NodeJS.Timeout> = new Map();

/**
 * Helper function to add delay
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper function with backoff and jitter
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const retryable = isRetryableError(error);
      if (!retryable) {
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Non-retryable error${contextMsg} - ${errorMsg}`);
        throw error;
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        const backoffDelay = CONFIG.RETRY_BASE_DELAY + (attempt * CONFIG.RETRY_BASE_DELAY);
        const jitter = Math.random() + 0.5;
        const delayWithJitter = Math.floor(backoffDelay * jitter);
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Retry attempt ${attempt + 1}/${CONFIG.MAX_RETRIES} after ${delayWithJitter}ms${contextMsg} - Error: ${errorMsg}`);
        await delay(delayWithJitter);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Get the current Bitcoin block height from mempool.space
 */
export async function getCurrentBlockHeight(): Promise<number> {
  return withRetry(async () => {
    const response = await fetch(CONFIG.MEMPOOL_API_URL, { timeout: 10_000 });
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, CONFIG.MEMPOOL_API_URL);
    }
    const height = await response.text();
    return parseInt(height, 10);
  }, 'GET mempool block height');
}

/**
 * Fetch block timestamp from mempool.space
 * First gets the block hash by height, then gets block details for timestamp
 */
async function fetchBlockTimestamp(blockHeight: number): Promise<number | null> {
  try {
    return await withRetry(async () => {
      // Step 1: Get block hash by height
      const hashUrl = `${CONFIG.MEMPOOL_BLOCK_URL}/${blockHeight}`;
      const hashResponse = await fetch(hashUrl, { timeout: 10_000 });
      
      if (!hashResponse.ok) {
        throw new HttpError(hashResponse.status, hashResponse.statusText, hashUrl);
      }
      
      const blockHash = await hashResponse.text();
      
      // Step 2: Get block details by hash
      const detailsUrl = `${CONFIG.MEMPOOL_BLOCK_DETAILS_URL}/${blockHash}`;
      const detailsResponse = await fetch(detailsUrl, { timeout: 10_000 });
      
      if (!detailsResponse.ok) {
        throw new HttpError(detailsResponse.status, detailsResponse.statusText, detailsUrl);
      }
      
      const blockDetails = await detailsResponse.json() as { timestamp: number };
      return blockDetails.timestamp;
    }, `GET block timestamp for ${blockHeight}`);
  } catch (error) {
    console.error(`Error fetching timestamp for block ${blockHeight}:`, error);
    return null;
  }
}

/**
 * Check if we have a timestamp for a block
 */
function hasBlockTimestamp(blockHeight: number): boolean {
  const db = getDb();
  const result = db.prepare(
    'SELECT 1 FROM block_timestamps WHERE block_height = ?'
  ).get(blockHeight);
  return result !== undefined;
}

/**
 * Store block timestamp
 */
function storeBlockTimestamp(blockHeight: number, timestamp: number): void {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO block_timestamps (block_height, timestamp) VALUES (?, ?)'
  ).run(blockHeight, timestamp);
}

/**
 * Fetch highest diff for a block (pool winner)
 */
async function fetchHighestDiff(blockHeight: number): Promise<HighestDiffResponse | null> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    console.error('Failed to fetch highest diff: No API_URL defined in env');
    return null;
  }

  const headers: Record<string, string> = {};
  if (process.env.API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
  }

  try {
    return await withRetry(async () => {
      const url = `${apiUrl}/highestdiff/${blockHeight}`;
      const response = await fetch(url, { headers, timeout: 10_000 });
      
      if (response.status === 404) {
        // No data for this block (might be too old or no shares submitted)
        return null;
      }
      
      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, url);
      }
      
      return await response.json() as HighestDiffResponse;
    }, `GET /highestdiff/${blockHeight}`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    console.error(`Error fetching highest diff for block ${blockHeight}:`, error);
    return null;
  }
}

/**
 * Fetch all users' highest diffs for a block
 */
async function fetchAllUserDiffs(blockHeight: number): Promise<UserDiffEntry[]> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    console.error('Failed to fetch user diffs: No API_URL defined in env');
    return [];
  }

  const headers: Record<string, string> = {};
  if (process.env.API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
  }

  try {
    return await withRetry(async () => {
      const url = `${apiUrl}/highestdiff/${blockHeight}/all`;
      const response = await fetch(url, { headers, timeout: 30_000 });
      
      if (response.status === 404) {
        return [];
      }
      
      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, url);
      }
      
      return await response.json() as UserDiffEntry[];
    }, `GET /highestdiff/${blockHeight}/all`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return [];
    }
    console.error(`Error fetching all user diffs for block ${blockHeight}:`, error);
    return [];
  }
}

/**
 * Check if we already have data for a block
 */
function hasBlockData(blockHeight: number): boolean {
  const db = getDb();
  const result = db.prepare(
    'SELECT 1 FROM block_highest_diff WHERE block_height = ?'
  ).get(blockHeight);
  return result !== undefined;
}

/**
 * Clean up old block data, keeping only the last MAX_BLOCKS_TO_KEEP blocks
 * Deletes from block_highest_diff, user_block_diff, and block_timestamps tables
 */
function cleanupOldBlocks(): void {
  const db = getDb();
  
  try {
    // Get the current max block height
    const result = db.prepare(
      'SELECT MAX(block_height) as max_height FROM block_highest_diff'
    ).get() as { max_height: number | null } | undefined;
    
    const maxHeight = result?.max_height;
    if (!maxHeight) return;
    
    const cutoffHeight = maxHeight - CONFIG.MAX_BLOCKS_TO_KEEP;
    
    // Delete old records from all tables in a transaction
    const deleted = db.transaction(() => {
      const winnerResult = db.prepare(
        'DELETE FROM block_highest_diff WHERE block_height < ?'
      ).run(cutoffHeight);
      
      const userResult = db.prepare(
        'DELETE FROM user_block_diff WHERE block_height < ?'
      ).run(cutoffHeight);
      
      const timestampResult = db.prepare(
        'DELETE FROM block_timestamps WHERE block_height < ?'
      ).run(cutoffHeight);
      
      return { winners: winnerResult.changes, users: userResult.changes, timestamps: timestampResult.changes };
    })();
    
    if (deleted.winners > 0 || deleted.users > 0 || deleted.timestamps > 0) {
      console.log(`🧹 Cleaned up old block diff data: ${deleted.winners} blocks, ${deleted.users} user entries, ${deleted.timestamps} timestamps (keeping blocks > ${cutoffHeight})`);
    }
  } catch (error) {
    console.error('Error cleaning up old block diff data:', error);
  }
}

/**
 * Collect and store highest diff data for a specific block
 */
export async function collectHighestDiff(blockHeight: number): Promise<boolean> {
  // Skip if we already have data for this block
  if (hasBlockData(blockHeight)) {
    // Still ensure we have the timestamp
    if (!hasBlockTimestamp(blockHeight)) {
      const timestamp = await fetchBlockTimestamp(blockHeight);
      if (timestamp) {
        storeBlockTimestamp(blockHeight, timestamp);
      }
    }
    return true;
  }

  const now = Math.floor(Date.now() / 1000);

  // Fetch pool winner
  const poolWinner = await fetchHighestDiff(blockHeight);
  if (!poolWinner) {
    // No data available for this block
    return false;
  }

  // Fetch all user diffs
  const userDiffs = await fetchAllUserDiffs(blockHeight);
  
  // Fetch block timestamp from mempool.space
  const blockTimestamp = await fetchBlockTimestamp(blockHeight);

  const db = getDb();

  db.transaction(() => {
    // Store pool winner
    const winnerStmt = db.prepare(`
      INSERT OR REPLACE INTO block_highest_diff (
        block_height, winner_address, difficulty, collected_at
      ) VALUES (?, ?, ?, ?)
    `);
    winnerStmt.run(blockHeight, poolWinner.username, poolWinner.diff, now);

    // Store all user diffs
    if (userDiffs.length > 0) {
      const userStmt = db.prepare(`
        INSERT OR REPLACE INTO user_block_diff (
          block_height, address, difficulty, collected_at
        ) VALUES (?, ?, ?, ?)
      `);

      for (const entry of userDiffs) {
        userStmt.run(blockHeight, entry.username, entry.diff, now);
      }
    }
    
    // Store block timestamp if we got it
    if (blockTimestamp) {
      db.prepare(
        'INSERT OR REPLACE INTO block_timestamps (block_height, timestamp) VALUES (?, ?)'
      ).run(blockHeight, blockTimestamp);
    }
  })();

  console.log(`📊 Collected highest diff for block ${blockHeight}: winner=${poolWinner.username.substring(0, 12)}... diff=${poolWinner.diff.toExponential(2)}, ${userDiffs.length} users`);
  
  // Clean up old block data to keep only the last MAX_BLOCKS_TO_KEEP blocks
  cleanupOldBlocks();
  
  return true;
}

/**
 * Backfill historical data on startup
 * Checks the last BACKFILL_BLOCKS blocks and fills in any missing entries
 */
export async function backfillHighestDiff(): Promise<void> {
  console.log(`🔄 Starting highest diff backfill (last ${CONFIG.BACKFILL_BLOCKS} blocks)...`);

  try {
    const currentHeight = await getCurrentBlockHeight();
    const startHeight = currentHeight - CONFIG.BACKFILL_BLOCKS + 1;

    let collected = 0;
    let skipped = 0;
    let failed = 0;

    for (let height = startHeight; height <= currentHeight; height++) {
      if (hasBlockData(height)) {
        skipped++;
        continue;
      }

      const success = await collectHighestDiff(height);
      if (success) {
        collected++;
      } else {
        failed++;
      }

      // Small delay to avoid overwhelming the API
      await delay(100);
    }

    console.log(`✅ Backfill complete: ${collected} collected, ${skipped} skipped (already had), ${failed} failed/empty`);
  } catch (error) {
    console.error('Error during highest diff backfill:', error);
  }
}

/**
 * Trigger a delayed collection for a block (called when clean_jobs is detected)
 * Waits 1 minute to allow shares to settle before collecting
 */
export function triggerDelayedCollection(blockHeight: number): void {
  // Cancel any pending collection for this block
  const existingTimeout = pendingCollections.get(blockHeight);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  console.log(`⏳ Scheduling highest diff collection for block ${blockHeight} in ${CONFIG.COLLECTION_DELAY_MS / 1000}s`);

  const timeout = setTimeout(async () => {
    pendingCollections.delete(blockHeight);
    try {
      await collectHighestDiff(blockHeight);
    } catch (error) {
      console.error(`Error collecting highest diff for block ${blockHeight}:`, error);
    }
  }, CONFIG.COLLECTION_DELAY_MS);

  pendingCollections.set(blockHeight, timeout);
}

/**
 * Periodic collection job - collects for recent blocks
 * Runs every 10 minutes to catch any missed blocks
 */
async function periodicCollection(): Promise<void> {
  if (isCollecting) {
    console.warn('⚠️ Highest diff collection already running, skipping this cycle');
    return;
  }

  try {
    isCollecting = true;

    const currentHeight = await getCurrentBlockHeight();
    
    // Check last 10 blocks for any missing data
    const blocksToCheck = 10;
    let collected = 0;

    for (let i = 0; i < blocksToCheck; i++) {
      const height = currentHeight - i;
      if (!hasBlockData(height)) {
        const success = await collectHighestDiff(height);
        if (success) {
          collected++;
        }
        await delay(100);
      }
    }

    if (collected > 0) {
      console.log(`📊 Periodic collection: collected ${collected} missing blocks`);
    }
  } catch (error) {
    console.error('Error in periodic highest diff collection:', error);
  } finally {
    isCollecting = false;
  }
}

/**
 * Start the highest diff collector
 * - Runs backfill on startup
 * - Sets up periodic collection every 10 minutes
 */
export function startHighestDiffCollector(): { job: ReturnType<typeof cron.schedule> } {
  // Run backfill on startup
  backfillHighestDiff();

  // Schedule periodic collection every 10 minutes
  const job = cron.schedule('*/10 * * * *', async () => {
    await periodicCollection();
  });

  console.log('📊 Highest diff collector started (periodic collection every 10 minutes)');

  return { job };
}

/**
 * Stop the collector and clear pending collections
 */
export function stopHighestDiffCollector(): void {
  for (const timeout of pendingCollections.values()) {
    clearTimeout(timeout);
  }
  pendingCollections.clear();
  console.log('📊 Highest diff collector stopped');
}

/**
 * Get the last collected block height
 */
export function getLastCollectedBlock(): number | null {
  const db = getDb();
  const result = db.prepare(
    'SELECT MAX(block_height) as max_height FROM block_highest_diff'
  ).get() as { max_height: number | null } | undefined;
  return result?.max_height ?? null;
}

