import cron from 'node-cron';
import { getDb } from './db';
import { fetch } from './http-client';
import { HttpError, withRetry } from './retry-utils';
import {
  UserData,
  MonitoredUser,
  isStatsData,
  isHashrateData,
  getCaseInsensitive,
} from './pool-types';
import {
  discoverPoolUsersEndpoint,
  discoverPoolStatsEndpoint,
  getUserStatsEndpoint,
} from './endpoint-discovery';

let isCollectorRunning = false;
let isUserCollectorRunning = false;
let userCollectionStartTime = 0; // Track when collection started for timeout detection

// Configuration constants
const CONFIG = {
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_ATTEMPTS || '10'),
  BATCH_SIZE: parseInt(process.env.USER_BATCH_SIZE || '500'), // Process users in batches (concurrent API requests)
  FAILED_USER_BACKOFF_MINUTES: parseInt(process.env.FAILED_USER_BACKOFF_MINUTES || '2'), // Don't retry failed users for 2 minutes
  AUTO_DISCOVER_USERS: process.env.AUTO_DISCOVER_USERS !== 'false', // Enable automatic user discovery (default: true)
  AUTO_DISCOVER_BATCH_LIMIT: parseInt(process.env.AUTO_DISCOVER_BATCH_LIMIT || '100'), // Max new users to add per cycle
  SQL_BATCH_SIZE: 500, // Max parameters per SQL statement (SQLite limit is 999)
  COLLECTION_TIMEOUT_MINUTES: parseInt(process.env.COLLECTION_TIMEOUT_MINUTES || '10'), // Force reset if collection hangs
} as const;

/**
 * Process users in batches to avoid overwhelming the system
 * @returns Object containing number of users collected and number deactivated
 */
async function processBatchedUserStats(users: MonitoredUser[]): Promise<{ collected: number; deactivated: number }> {
  let totalDeactivated = 0;
  
  for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
    const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(user => collectUserStats(user.id, user.address))
    );
    
    // Count deactivations in this batch
    const batchDeactivated = results.filter(
      result => result.status === 'fulfilled' && result.value === true
    ).length;
    totalDeactivated += batchDeactivated;
    
    console.log(`Processed batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(users.length / CONFIG.BATCH_SIZE)} (${batch.length} users)`);
  }
  
  return { collected: users.length, deactivated: totalDeactivated };
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

// Cache for discovered endpoint paths
let discoveredPoolUsersPath: string | null = null;
let discoveredPoolStatsPath: string | null = null;
let discoveredUserStatsPath: string | null = null;

/**
 * Fetch user stats and store them in the database
 * @returns true if user was deactivated, false otherwise
 */
async function collectUserStats(userId: number, address: string): Promise<boolean> {
  try {
    const response = await withRetry(async () => {
      const apiUrl = process.env.API_URL;
      if (!apiUrl) {
        console.error("Failed to fetch user data: No API_URL defined in env");
        throw new Error(`Failed to fetch user data: No API_URL defined in env`);
      }

      const headers: Record<string, string> = {};
      if (process.env.API_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
      }

      // Get or discover the endpoint path
      if (!discoveredUserStatsPath) {
        const configuredPath = process.env.USER_STATS_ENDPOINT;
        if (configuredPath) {
          discoveredUserStatsPath = configuredPath;
          console.log(`Using configured user stats endpoint: ${configuredPath}`);
        } else {
          // Use shared promise pattern - all concurrent requests will await the same discovery
          try {
            discoveredUserStatsPath = await getUserStatsEndpoint(apiUrl, headers, address);
          } catch (error) {
            // Discovery failed - this is expected if user stats endpoint doesn't exist
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Could not discover user stats endpoint: ${errorMsg}`);
          }
        }
      }

      // Replace {address} placeholder with actual address
      const endpoint = discoveredUserStatsPath.replace('{address}', address);

      try {
        const res = await fetch(`${apiUrl}${endpoint}`, {
          headers,
        });
        if (!res.ok) {
          // Try to get response body for more details
          let errorDetail = res.statusText;
          try {
            const body = await res.text();
            if (body) errorDetail += `: ${body}`;
          } catch {}
          
          // Don't clear discoveredUserStatsPath on 404 for individual users
          // A 404 for a specific user is normal (user may not have stats yet)
          // Only the discovery process should determine if the endpoint is invalid
          
          // Throw HttpError with status code so retry logic can determine if it's retryable
          throw new HttpError(errorDetail, res.status);
        }
        return res;
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
    }, {
      maxRetries: 2,
      initialDelay: 200,
      onRetry: (error, attempt, delay) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`Retry attempt ${attempt}/2 after ${delay}ms [GET /users/${address}] - Error: ${errorMsg}`);
      }
    });

    const userData: UserData = await response.json();
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

      // Update current stats (upsert)
      const currentStmt = db.prepare(`
        INSERT INTO user_stats_current (
          user_id,
          hashrate1m,
          hashrate5m,
          hashrate1hr,
          hashrate1d,
          hashrate7d,
          workers,
          bestshare,
          bestever,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          hashrate1m = excluded.hashrate1m,
          hashrate5m = excluded.hashrate5m,
          hashrate1hr = excluded.hashrate1hr,
          hashrate1d = excluded.hashrate1d,
          hashrate7d = excluded.hashrate7d,
          workers = excluded.workers,
          bestshare = excluded.bestshare,
          bestever = excluded.bestever,
          updated_at = excluded.updated_at
      `);
      
      currentStmt.run(
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

      // Update the user record (mark as successful, reset failed attempts)
      const updateUserStmt = db.prepare(`
        UPDATE monitored_users 
        SET updated_at = ?, 
            failed_attempts = 0,
            authorised_at = ?
        WHERE id = ?
      `);
      
      updateUserStmt.run(now, userData.authorised, userId);
    })();

    return false; // User stats collected successfully, not deactivated
  } catch {
    // Record failure
    const db = getDb();
    const updateFailStmt = db.prepare(`
      UPDATE monitored_users 
      SET failed_attempts = failed_attempts + 1,
          updated_at = ?
      WHERE id = ?
    `);
    
    const now = Math.floor(Date.now() / 1000);
    updateFailStmt.run(now, userId);

    // Check if we should deactivate this user
    const user = db.prepare('SELECT failed_attempts FROM monitored_users WHERE id = ?').get(userId) as { failed_attempts: number };
    
    if (user && user.failed_attempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
      db.prepare('UPDATE monitored_users SET is_active = 0 WHERE id = ?').run(userId);
      return true; // User was deactivated
    }
    
    return false; // User failed but not yet deactivated
  }
}

/**
 * Collect stats for all monitored users
 */
async function collectAllUserStats() {
  if (isUserCollectorRunning) {
    // Check if collection has been running too long (hung/stuck)
    const now = Date.now();
    const elapsedMinutes = (now - userCollectionStartTime) / (1000 * 60);
    
    if (elapsedMinutes > CONFIG.COLLECTION_TIMEOUT_MINUTES) {
      console.error(
        `❌ User stats collection has been stuck for ${Math.floor(elapsedMinutes)} minutes! ` +
        `Force-resetting the lock. This indicates a serious issue that needs investigation.`
      );
      isUserCollectorRunning = false;
      userCollectionStartTime = 0;
      // Fall through to start a new collection
    } else {
      console.log("⚠️  User stats collection already running, skipping this cycle");
      return;
    }
  }

  try {
    // Get pool users list first to determine who is active
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Error fetching pool users: No API_URL defined in env");
      return;
    }

    // Fetch the pool user list
    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    // Discover endpoint on first run or use cached/configured path
    if (!discoveredPoolUsersPath) {
      // Check if user configured it via env var
      const configuredPath = process.env.POOL_USERS_ENDPOINT;
      if (configuredPath) {
        discoveredPoolUsersPath = configuredPath;
        console.log(`Using configured pool users endpoint: ${configuredPath}`);
      } else {
        // Auto-discover
        console.log(`🔍 Discovering pool users list endpoint...`);
        try {
          discoveredPoolUsersPath = await discoverPoolUsersEndpoint(apiUrl, headers);
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          return; // Skip this cycle
        }
      }
    }

    // Set the flag AFTER initial checks pass - prevents flag getting stuck on early returns
    isUserCollectorRunning = true;
    userCollectionStartTime = Date.now();

    const poolUsersText = await withRetry(async () => {
      const response = await fetch(`${apiUrl}${discoveredPoolUsersPath}`, { headers });
      if (!response.ok) {
        // On 404, clear cached path and try discovery again next time
        if (response.status === 404) {
          discoveredPoolUsersPath = null;
        }
        throw new HttpError(`Failed to fetch pool users: ${response.statusText}`, response.status);
      }
      return response.text();
    }, {
      maxRetries: 2,
      initialDelay: 500,
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt}/2 after ${delay}ms [GET ${discoveredPoolUsersPath}]`);
      }
    });

    // Parse pool users - handle JSON array, newline-delimited, and comma-separated formats
    let poolUsersArray: string[];
    const trimmedText = poolUsersText.trim();
    
    if (trimmedText.startsWith('[') && trimmedText.endsWith(']')) {
      // JSON array format: ["addr1", "addr2", "addr3"]
      try {
        poolUsersArray = JSON.parse(trimmedText) as string[];
      } catch (error) {
        console.error('Failed to parse pool users JSON:', error);
        poolUsersArray = [];
      }
    } else if (trimmedText.includes('\n')) {
      // Newline-delimited format: addr1\naddr2\naddr3
      poolUsersArray = trimmedText.split('\n');
    } else if (trimmedText.includes(',')) {
      // Comma-separated format: "addr1","addr2","addr3" or addr1,addr2,addr3
      poolUsersArray = trimmedText.split(',');
    } else {
      // Single address or unknown format
      poolUsersArray = [trimmedText];
    }
    
    // Filter out empty, whitespace-only, quotes, or invalid addresses
    const poolUsers = new Set(
      poolUsersArray
        .map(addr => addr.trim().replace(/^["']|["']$/g, '')) // Remove surrounding quotes
        .filter(addr => addr.length > 0 && addr !== '[]' && !addr.startsWith('['))
    );

    // SAFETY CHECK: If pool users list is empty or suspiciously small, something is wrong
    // Don't deactivate all users - skip this cycle and try again next time
    if (poolUsers.size === 0) {
      console.error(`❌ Pool users list is EMPTY! API may have returned invalid data. Skipping cycle to prevent deactivating all users.`);
      console.error(`Raw API response (first 500 chars): ${poolUsersText.substring(0, 500)}`);
      return;
    }
    
    // Warn if pool users list is suspiciously small (less than 10% of previous known users)
    const db = getDb();
    const activeUserCount = db.prepare('SELECT COUNT(*) as count FROM monitored_users WHERE is_active = 1').get() as { count: number };
    if (activeUserCount.count > 100 && poolUsers.size < activeUserCount.count * 0.1) {
      console.warn(
        `⚠️  WARNING: Pool users list seems suspiciously small! ` +
        `Found ${poolUsers.size} users in pool, but we have ${activeUserCount.count} active monitored users. ` +
        `This may indicate an API issue. Proceeding with caution...`
      );
    }
    
    // Log pool users count for debugging
    console.log(`✓ Found ${poolUsers.size} users currently in pool`);
    const now = Math.floor(Date.now() / 1000);
    const backoffThreshold = now - (CONFIG.FAILED_USER_BACKOFF_MINUTES * 60);

    let addedCount = 0;
    let deactivatedCount = 0;
    let reactivatedCount = 0;

    // Get all monitored users
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

    const { collected: collectedCount, deactivated: failedDeactivatedCount } = await processBatchedUserStats(usersToCollect);

    // Log summary
    const lifecycleChanges = addedCount + deactivatedCount + reactivatedCount;
    if (lifecycleChanges > 0) {
      console.log(`User lifecycle: ${addedCount} added, ${deactivatedCount} deactivated, ${reactivatedCount} reactivated`);
    }
    if (failedDeactivatedCount > 0) {
      console.log(`⚠️  Deactivated ${failedDeactivatedCount} users after ${CONFIG.MAX_FAILED_ATTEMPTS} failed attempts`);
    }
    console.log(`Collected stats for ${collectedCount} users at ${new Date().toISOString()}`);

  } catch (error) {
    // Only log if it's not a 404 (404s are already logged by withRetry)
    if (!(error instanceof HttpError && error.statusCode === 404)) {
      console.error("Error collecting user stats:", error);
    }
  } finally {
    isUserCollectorRunning = false;
    userCollectionStartTime = 0;
  }
}

/**
 * Fetch pool stats and store them in the database
 */
export async function collectPoolStats() {
  if (isCollectorRunning) return;

  try {
    isCollectorRunning = true;
    
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Error fetching pool stats: No API_URL defined in env");
      return;
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    // Discover endpoint on first run or use cached/configured path
    if (!discoveredPoolStatsPath) {
      // Check if user configured it via env var
      const configuredPath = process.env.POOL_STATS_ENDPOINT;
      if (configuredPath) {
        discoveredPoolStatsPath = configuredPath;
        console.log(`Using configured pool stats endpoint: ${configuredPath}`);
      } else {
        // Auto-discover
        console.log(`🔍 Discovering pool statistics endpoint (pool-wide metrics)...`);
        try {
          discoveredPoolStatsPath = await discoverPoolStatsEndpoint(apiUrl, headers);
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          return; // Skip this cycle
        }
      }
    }

    const text = await withRetry(async () => {
      const response = await fetch(`${apiUrl}${discoveredPoolStatsPath}`, {
        headers,
      });
      if (!response.ok) {
        // On 404, clear cached path and try discovery again next time
        if (response.status === 404) {
          discoveredPoolStatsPath = null;
        }
        throw new HttpError(`Failed to fetch pool stats: ${response.statusText}`, response.status);
      }
      return response.text();
    }, {
      maxRetries: 2,
      initialDelay: 500,
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt}/2 after ${delay}ms [GET ${discoveredPoolStatsPath}]`);
      }
    });
    
    // Split the response into lines and parse each JSON object
    const jsonLines = text.trim().split('\n').filter(line => line.trim().length > 0).map(line => JSON.parse(line) as Record<string, unknown>);
    
    if (jsonLines.length < 2) {
      console.error(`Expected at least 2 JSON objects but got ${jsonLines.length}`);
      console.error('Response:', text.substring(0, 500));
      throw new Error(`Incomplete response: expected at least 2 JSON objects but got ${jsonLines.length}`);
    }
    
    // Extract the data from different objects
    const statsData = jsonLines[0] as Record<string, unknown>;
    const hashrateData = jsonLines[1] as Record<string, unknown>;
    
    // Validate using type guards
    if (!isStatsData(statsData)) {
      console.error('Invalid stats data structure. Available keys:', Object.keys(statsData));
      throw new Error('Missing required stats data fields (Users/Workers)');
    }
    
    if (!isHashrateData(hashrateData)) {
      console.error('Invalid hashrate data structure. Available keys:', Object.keys(hashrateData));
      throw new Error('Missing required hashrate data (hashrate15m)');
    }
    
    // Now TypeScript knows these are the correct types
    // Extract values with case-insensitive matching and assert types
    const runtime = getCaseInsensitive(statsData, 'runtime') as number | undefined;
    const users = (getCaseInsensitive(statsData, 'Users') ?? getCaseInsensitive(statsData, 'users')) as number;
    const workers = (getCaseInsensitive(statsData, 'Workers') ?? getCaseInsensitive(statsData, 'workers')) as number;
    const idle = (getCaseInsensitive(statsData, 'Idle') ?? getCaseInsensitive(statsData, 'idle') ?? 0) as number;
    const disconnected = (getCaseInsensitive(statsData, 'Disconnected') ?? getCaseInsensitive(statsData, 'disconnected') ?? 0) as number;
    
    const hashrate1m = getCaseInsensitive(hashrateData, 'hashrate1m') as string | undefined;
    const hashrate5m = getCaseInsensitive(hashrateData, 'hashrate5m') as string | undefined;
    const hashrate15m = getCaseInsensitive(hashrateData, 'hashrate15m') as string;
    const hashrate1hr = getCaseInsensitive(hashrateData, 'hashrate1hr') as string | undefined;
    const hashrate6hr = getCaseInsensitive(hashrateData, 'hashrate6hr') as string | undefined;
    const hashrate1d = getCaseInsensitive(hashrateData, 'hashrate1d') as string | undefined;
    const hashrate7d = getCaseInsensitive(hashrateData, 'hashrate7d') as string | undefined;
    
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
      runtime ?? 0,
      users,
      workers,
      idle,
      disconnected,
      hashrate1m ?? '0',
      hashrate5m ?? '0',
      hashrate15m,
      hashrate1hr ?? '0',
      hashrate6hr ?? '0',
      hashrate1d ?? '0',
      hashrate7d ?? '0'
    );
    
    console.log(`Pool stats collected and stored at ${new Date().toISOString()}`);
    
  } catch (error) {
    // Only log if it's not a 404 (404s are already logged by withRetry)
    if (!(error instanceof HttpError && error.statusCode === 404)) {
      console.error("Error collecting pool stats:", error);
    }
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
  
  console.log('Stats collectors started');
  
  // Run initial collections immediately
  collectPoolStats();
  collectAllUserStats();
  
  return {
    poolJob,
    userJob
  };
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
