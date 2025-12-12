import cron from 'node-cron';
import { getDb } from './db';
import { fetch, HttpError, isRetryableError } from './http-client';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';

interface StatsData {
  runtime: number;
  lastupdate: number;
  Users: number;
  Workers: number;
  Idle: number;
  Disconnected: number;
}

interface HashrateData {
  hashrate1m: string;
  hashrate5m: string;
  hashrate15m: string;
  hashrate1hr: string;
  hashrate6hr: string;
  hashrate1d: string;
  hashrate7d: string;
}

interface UserData {
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  workers: number;
  bestshare: number;
  bestever: number;
  authorised: number;
}

interface MonitoredUser {
  id: number;
  address: string;
}

let isCollectorRunning = false;
let isUserCollectorRunning = false;
let isAccountJobRunning = false;

// Configuration constants
const CONFIG = {
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_ATTEMPTS || '10'),
  BATCH_SIZE: parseInt(process.env.USER_BATCH_SIZE || '500'), // Process users in batches (concurrent API requests)
  FAILED_USER_BACKOFF_MINUTES: parseInt(process.env.FAILED_USER_BACKOFF_MINUTES || '2'), // Don't retry failed users for 2 minutes
  AUTO_DISCOVER_USERS: process.env.AUTO_DISCOVER_USERS !== 'false', // Enable automatic user discovery (default: true)
  AUTO_DISCOVER_BATCH_LIMIT: parseInt(process.env.AUTO_DISCOVER_BATCH_LIMIT || '100'), // Max new users to add per cycle
  SQL_BATCH_SIZE: 500, // Max parameters per SQL statement (SQLite limit is 999)
} as const;

/**
 * Helper function to add delay between retries
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper function with backoff and jitter
 * Intelligently skips retries for non-retryable errors (4xx client errors)
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 500,
  context?: string // Optional context for logging which operation is retrying
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable before attempting retry
      const retryable = isRetryableError(error);

      if (!retryable) {
        // Non-retryable error (e.g., 404, 400, 403) - fail immediately
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Non-retryable error${contextMsg} - ${errorMsg}`);
        throw error;
      }

      if (attempt < maxRetries) {
        const backoffDelay = baseDelay + (attempt * baseDelay);
        // Add jitter: randomize delay between 50% and 150% of backoff delay
        const jitter = Math.random() + 0.5; // Random value between 0.5 and 1.5
        const delayWithJitter = Math.floor(backoffDelay * jitter);
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayWithJitter}ms${contextMsg} - Error: ${errorMsg}`);
        await delay(delayWithJitter);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Process users in batches to avoid overwhelming the system
 */
async function processBatchedUserStats(users: MonitoredUser[]): Promise<number> {
  for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
    const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
    await Promise.allSettled(
      batch.map(user => collectUserStats(user.id, user.address))
    );
    console.log(`Processed batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(users.length / CONFIG.BATCH_SIZE)} (${batch.length} users)`);
  }
  return users.length;
}

/**
 * Update users in chunks to respect SQLite's 999 parameter limit
 * Executes UPDATE statements in batches for large user ID arrays
 */
function updateUsersInChunks(
  db: ReturnType<typeof getDb>,
  userIds: number[],
  sqlTemplate: string,
  params: unknown[]
): number {
  let totalUpdated = 0;

  // Process in chunks to stay well below SQLite's 999 parameter limit
  for (let i = 0; i < userIds.length; i += CONFIG.SQL_BATCH_SIZE) {
    const chunk = userIds.slice(i, i + CONFIG.SQL_BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    const sql = sqlTemplate.replace('${placeholders}', placeholders);

    // Run the update with params first, then the chunk IDs
    const result = db.prepare(sql).run(...params, ...chunk);
    totalUpdated += result.changes;
  }

  return totalUpdated;
}

/**
 * Fetch user stats and store them in the database
 */
async function collectUserStats(userId: number, address: string): Promise<void> {
  try {
    // Include response.json() inside retry wrapper to handle connection errors during body reading
    const userData = await withRetry(async () => {
      const apiUrl = process.env.API_URL;
      if (!apiUrl) {
        console.error("Failed to fetch user data: No API_URL defined in env");
        throw new Error(`Failed to fetch user data: No API_URL defined in env`);
      }

      const headers: Record<string, string> = {};
      if (process.env.API_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
      }

      try {
        const res = await fetch(`${apiUrl}/aggregator/users/${address}`, {
          headers,
        });
        if (!res.ok) {
          // Try to get response body for more details
          let responseBody: string | undefined;
          try {
            responseBody = await res.text();
          } catch {}
          // Throw HttpError with status code so retry logic can determine if it's retryable
          throw new HttpError(res.status, res.statusText, `${apiUrl}/aggregator/users/${address}`, responseBody || undefined);
        }
        // Parse JSON inside retry wrapper to handle connection errors during body reading
        return await res.json() as UserData;
      } catch (error) {
        // Re-throw HttpError as-is to preserve status code
        if (error instanceof HttpError) {
          throw error;
        }
        // Re-throw with more context if it's a network error
        if (error instanceof Error && error.message === 'fetch failed') {
          throw new Error(`Network error: ${error.message} (${error.cause || 'unknown cause'})`);
        }
        throw error;
      }
    }, 5, 300, `GET /users/${address}`);
    const now = Math.floor(Date.now() / 1000);

    // Insert data into the database
    const db = getDb();
    
    // Begin transaction
    db.transaction(() => {
      // Insert historical data
      const historyStmt = db.prepare(`
        INSERT INTO user_stats_history (
          user_id,
          hashrate1m,
          hashrate5m,
          hashrate1hr,
          hashrate1d,
          hashrate7d,
          workers,
          bestshare,
          bestever,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      historyStmt.run(
        userId,
        userData.hashrate1m,
        userData.hashrate5m,
        userData.hashrate1hr,
        userData.hashrate1d,
        userData.hashrate7d,
        userData.workers,
        userData.bestshare,
        userData.bestever,
        now
      );

      // Update monitored_users with latest bestever and earliest authorised_at
      // bestever: only increase (higher is better)
      // authorised_at: only decrease to earlier timestamp (earlier = more loyal), but never to 0
      // Also reset failed_attempts since we succeeded
      const updateStmt = db.prepare(`
        UPDATE monitored_users
        SET
          bestever = CASE WHEN bestever < ? THEN ? ELSE bestever END,
          authorised_at = CASE
            WHEN ? > 0 AND (authorised_at = 0 OR authorised_at > ?)
            THEN ?
            ELSE authorised_at
          END,
          failed_attempts = 0,
          updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        userData.bestever,
        userData.bestever,
        userData.authorised,     // Check if API value is valid (> 0)
        userData.authorised,     // Compare against existing value
        userData.authorised,     // Set to this value if conditions met
        now,
        userId
      );
    })();

  } catch (error) {
    console.error(`Error collecting stats for user ${address}:`, error);
    
    // Increment failed attempts and deactivate if threshold reached
    const db = getDb();
    db.transaction(() => {
      // First get the current failed attempts count
      const user = db.prepare('SELECT failed_attempts FROM monitored_users WHERE id = ?').get(userId) as { failed_attempts: number };
      const newFailedAttempts = (user?.failed_attempts ?? 0) + 1;
      const now = Math.floor(Date.now() / 1000);

      // Then update based on the new count
      const updateStmt = db.prepare(`
        UPDATE monitored_users 
        SET 
          failed_attempts = ?,
          is_active = ?,
          updated_at = ?
        WHERE id = ?
      `);

      // If we hit max failures, deactivate and reset counter, otherwise just increment
      updateStmt.run(
        newFailedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS ? 0 : newFailedAttempts,
        newFailedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS ? 0 : 1,
        now,
        userId
      );

      if (newFailedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
        console.log(`Deactivating user ${address} after ${CONFIG.MAX_FAILED_ATTEMPTS} failed attempts`);
      }
    })();
  }
}

/**
 * Fetch stats for all monitored users and manage user lifecycle
 * Handles auto-discovery, deactivation, and reactivation of users
 */
export async function collectAllUserStats() {
  if (isUserCollectorRunning) {
    console.warn('⚠️  User stats collection already running, skipping this cycle');
    return;
  }

  try {
    isUserCollectorRunning = true;
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const backoffThreshold = now - (CONFIG.FAILED_USER_BACKOFF_MINUTES * 60);

    // Fetch current pool users list directly from API
    let poolUsers: Set<string>;
    try {
      poolUsers = await withRetry(async () => {
        const apiUrl = process.env.API_URL;
        if (!apiUrl) {
          throw new Error('API_URL is not defined in environment variables');
        }

        const headers: Record<string, string> = {};
        if (process.env.API_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
        }

        const response = await fetch(`${apiUrl}/aggregator/users`, { headers });
        if (!response.ok) {
          throw new HttpError(response.status, response.statusText, `${apiUrl}/aggregator/users`);
        }

        const data = await response.json();
        // API returns array of address strings
        return new Set<string>(data as string[]);
      }, 5, 300, 'GET /users');
    } catch (error) {
      console.error('Error fetching pool users:', error);
      poolUsers = new Set<string>();
    }

    if (poolUsers.size === 0) {
      console.warn('⚠️  Pool users API returned empty - either API failed or pool is actually empty');
      console.log('Skipping auto-discovery and lifecycle management, collecting stats for known active users only');

      // Collect stats for existing active users even when API is down
      const knownUsers = db.prepare(`
        SELECT id, address, updated_at, failed_attempts
        FROM monitored_users
        WHERE is_active = 1
      `).all() as Array<{ id: number; address: string; updated_at: number; failed_attempts: number }>;

      // Apply backoff for users with recent failures
      const usersToCollect = knownUsers.filter(user => {
        return user.failed_attempts === 0 || user.updated_at < backoffThreshold;
      });

      const collectedCount = await processBatchedUserStats(usersToCollect);
      console.log(`Collected stats for ${collectedCount} known users at ${new Date().toISOString()}`);
      return;
    }

    // Track lifecycle changes for logging
    let addedCount = 0;
    let deactivatedCount = 0;
    let reactivatedCount = 0;

    // Get all monitored users (active and inactive) with all needed fields
    // We fetch this once and reuse for both auto-discovery and lifecycle management
    const allUsers = db.prepare(`
      SELECT id, address, is_active, updated_at, failed_attempts
      FROM monitored_users
    `).all() as Array<{
      id: number;
      address: string;
      is_active: number;
      updated_at: number;
      failed_attempts: number;
    }>;

    // Auto-discover new users if enabled
    if (CONFIG.AUTO_DISCOVER_USERS) {
      const existingAddresses = new Set(allUsers.map(u => u.address));
      const newAddresses: string[] = [];

      // Collect new addresses
      for (const address of poolUsers) {
        if (!existingAddresses.has(address)) {
          newAddresses.push(address);
          // Stop at batch limit to prevent overwhelming the database
          if (newAddresses.length >= CONFIG.AUTO_DISCOVER_BATCH_LIMIT) {
            break;
          }
        }
      }

      // Insert new users in a transaction for better performance
      if (newAddresses.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO monitored_users (
            address,
            is_active,
            is_public,
            created_at,
            updated_at,
            authorised_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertTransaction = db.transaction(() => {
          for (const address of newAddresses) {
            const result = insertStmt.run(address, 1, 1, now, now, 0);
            addedCount++;
            // Add to allUsers array so they get processed in this cycle
            allUsers.push({
              id: result.lastInsertRowid as number,
              address,
              is_active: 1,
              updated_at: now,
              failed_attempts: 0
            });
          }
        });

        insertTransaction();

        const totalNewUsers = Array.from(poolUsers).filter(addr => !existingAddresses.has(addr)).length;
        if (totalNewUsers > CONFIG.AUTO_DISCOVER_BATCH_LIMIT) {
          console.log(`⚠️  Found ${totalNewUsers} new users, added ${addedCount} (limited to ${CONFIG.AUTO_DISCOVER_BATCH_LIMIT} per cycle)`);
        }
      }
    }

    // Separate users by status and pool presence
    const usersToCollect: MonitoredUser[] = [];
    const usersToDeactivate: number[] = [];
    const usersToReactivate: number[] = [];

    for (const user of allUsers) {
      const inPool = poolUsers.has(user.address);
      const isActive = user.is_active === 1;

      if (inPool && isActive) {
        // Active user in pool - collect stats (with backoff check)
        if (user.failed_attempts === 0 || user.updated_at < backoffThreshold) {
          usersToCollect.push({ id: user.id, address: user.address });
        }
      } else if (inPool && !isActive) {
        // User came back to pool - reactivate
        usersToReactivate.push(user.id);
      } else if (!inPool && isActive) {
        // User left pool - deactivate
        usersToDeactivate.push(user.id);
      }
    }

    // Update user states in a single transaction for better performance
    // Use chunked updates to respect SQLite's 999 parameter limit
    if (usersToReactivate.length > 0 || usersToDeactivate.length > 0) {
      const updateTransaction = db.transaction(() => {
        // Reactivate users who came back
        if (usersToReactivate.length > 0) {
          reactivatedCount = updateUsersInChunks(
            db,
            usersToReactivate,
            `UPDATE monitored_users
             SET is_active = 1, failed_attempts = 0, updated_at = ?
             WHERE id IN (\${placeholders})`,
            [now]
          );
        }

        // Deactivate users who left
        if (usersToDeactivate.length > 0) {
          deactivatedCount = updateUsersInChunks(
            db,
            usersToDeactivate,
            `UPDATE monitored_users
             SET is_active = 0, updated_at = ?
             WHERE id IN (\${placeholders})`,
            [now]
          );
        }
      });

      updateTransaction();
    }

    const collectedCount = await processBatchedUserStats(usersToCollect);

    // Log summary
    const lifecycleChanges = addedCount + deactivatedCount + reactivatedCount;
    if (lifecycleChanges > 0) {
      console.log(`User lifecycle: ${addedCount} added, ${deactivatedCount} deactivated, ${reactivatedCount} reactivated`);
    }
    console.log(`Collected stats for ${collectedCount} users at ${new Date().toISOString()}`);

  } catch (error) {
    console.error("Error collecting user stats:", error);
  } finally {
    isUserCollectorRunning = false;
  }
}

/**
 * Fetch pool stats and store them in the database
 */
export async function collectPoolStats() {
  if (isCollectorRunning) return;

  try {
    isCollectorRunning = true;
    
    const text = await withRetry(async () => {
      const apiUrl = process.env.API_URL;
      if (!apiUrl) {
        console.error("Error fetching pool stats: No API_URL defined in env");
        throw new Error('API_URL is not defined in environment variables');
      }

      const headers: Record<string, string> = {};
      if (process.env.API_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
      }

      const url = `${apiUrl}/aggregator/pool/pool.status`;
      const response = await fetch(url, {
        headers,
      });
      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, url);
      }
      return response.text();
    }, 5, 300, 'GET /pool/pool.status');
    
    // Split the response into lines and parse each JSON object
    const jsonLines = text.trim().split('\n').map(line => JSON.parse(line));
    
    // Extract the data from different objects
    const statsData = jsonLines[0] as StatsData;
    const hashrateData = jsonLines[1] as HashrateData;
    
    // Insert data into the database
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO pool_stats (
        timestamp, runtime, users, workers, idle, disconnected,
        hashrate1m, hashrate5m, hashrate15m, hashrate1hr, 
        hashrate6hr, hashrate1d, hashrate7d
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    stmt.run(
      timestamp,
      statsData.runtime,
      statsData.Users,
      statsData.Workers,
      statsData.Idle,
      statsData.Disconnected,
      hashrateData.hashrate1m,
      hashrateData.hashrate5m,
      hashrateData.hashrate15m,
      hashrateData.hashrate1hr,
      hashrateData.hashrate6hr,
      hashrateData.hashrate1d,
      hashrateData.hashrate7d
    );
    
    console.log(`Pool stats collected and stored at ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error("Error collecting pool stats:", error);
  } finally {
    isCollectorRunning = false;
  }
}

/**
 * Start the stats collection cron jobs
 */
export function startPoolStatsCollector() {
  // Run pool stats collection every minute
  const poolJob = cron.schedule('* * * * *', async () => {
    await collectPoolStats();
  });

  // Run user stats collection every 1 minute
  const userJob = cron.schedule('* * * * *', async () => {
    await collectAllUserStats();
  });

  // Run account data sync every 10 minutes (for total_blocks loyalty ranking)
  const accountJob = cron.schedule('*/10 * * * *', async () => {
    await syncAccountTotalBlocks();
  });
  
  console.log('Stats collectors started');
  
  // Run initial collections immediately
  collectPoolStats();
  collectAllUserStats();
  syncAccountTotalBlocks();
  
  return {
    poolJob,
    userJob,
    accountJob
  };
}

/**
 * Sync total_blocks from para server accounts to local SQLite
 * Used for loyalty ranking based on blocks mined
 */
export async function syncAccountTotalBlocks() {
  if (isAccountJobRunning) {
    console.warn('⚠️  Account job already running, skipping this cycle');
    return;
  }

  try {
    isAccountJobRunning = true;
    const db = getDb();
    const apiUrl = process.env.API_URL;

    if (!apiUrl) {
      console.error('Failed to sync account data: No API_URL defined in env');
      return;
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    // Get all active users
    const users = db.prepare('SELECT id, address FROM monitored_users WHERE is_active = 1').all() as Array<{ id: number; address: string }>;

    if (users.length === 0) {
      console.log('No active users to sync total_blocks for');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const updateStmt = db.prepare('UPDATE monitored_users SET total_blocks = ? WHERE id = ?');
    const updateBatch = db.transaction((updates: Array<{ id: number; total_blocks: number }>) => {
      for (const u of updates) updateStmt.run(u.total_blocks, u.id);
    });

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
      const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
      
      const results = await Promise.allSettled(batch.map(async (user) => {
        try {
          const url = `${apiUrl}/account/${user.address}`;
          const totalBlocks = await withRetry(async () => {
            const res = await fetchWithTimeout(url, { headers });

            // 404 is expected for users without accounts - treat as 0 blocks (also clears stale values)
            if (res.status === 404) return 0;

            if (!res.ok) {
              throw new HttpError(res.status, res.statusText, url);
            }

            const data = await res.json() as { total_blocks?: number; metadata?: { block_count?: number } };
            // Backend may provide blocks mined either as `total_blocks` or inside `metadata.block_count`
            return data.total_blocks ?? data.metadata?.block_count ?? 0;
          }, 4, 500, `account total_blocks ${user.address}`);

          return { success: true, update: { id: user.id, total_blocks: totalBlocks } };
        } catch (err) {
          console.warn(`Failed to fetch total_blocks for ${user.address}:`, err instanceof Error ? err.message : err);
          return { success: false as const };
        }
      }));

      const updates: Array<{ id: number; total_blocks: number }> = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success && 'update' in result.value) {
          updates.push(result.value.update);
        }
      }

      if (updates.length > 0) {
        updateBatch(updates);
      }

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log(`Synced total_blocks for ${successCount} users (${errorCount} errors) at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Error syncing account total_blocks:', error);
  } finally {
    isAccountJobRunning = false;
  }
}

/**
 * Purge old data (keep only last 30 days by default)
 */
export function purgeOldData(daysToKeep = 30) {
  try {
    const db = getDb();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
    const poolResult = db.prepare('DELETE FROM pool_stats WHERE timestamp < ?').run(cutoffTimestamp);
    console.log(`Purged ${poolResult.changes} old pool stats records`);

    const userResult = db.prepare('DELETE FROM user_stats_history WHERE created_at < ?').run(cutoffTimestamp);
    console.log(`Purged ${userResult.changes} old user stats records`);
  } catch (error) {
    console.error("Error purging old stats:", error);
  }
}
