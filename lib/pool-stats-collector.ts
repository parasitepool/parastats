import cron from 'node-cron';
import { getDb } from './db';
import { fetch } from './http-client';

/**
 * Custom error class for HTTP errors with status codes
 */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Check if an error is an abort/timeout error (not retryable)
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check for abort-related error messages
    const message = error.message.toLowerCase();
    return (
      message.includes('abort') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      error.name === 'AbortError' ||
      error.name === 'TimeoutError'
    );
  }
  return false;
}

/**
 * Check if an error is retryable based on HTTP status code or error type
 *
 * Non-retryable errors (fail immediately):
 * - 4xx client errors (400, 401, 403, 404, 409, 422, etc.) - won't change on retry
 * - Abort/timeout errors - request took too long, retrying won't help
 *
 * Retryable errors (should retry with backoff):
 * - 429 Too Many Requests - rate limiting
 * - 5xx server errors (500, 502, 503, 504) - temporary server issues
 * - Network errors (connection refused, DNS failures, socket errors)
 * - ClientDestroyedError (UND_ERR_DESTROYED) - connection pool issues
 */
function isRetryableError(error: unknown): boolean {
  // Don't retry abort/timeout errors
  if (isAbortError(error)) {
    return false;
  }

  if (error instanceof HttpError) {
    const status = error.status;

    // Rate limiting - should retry with backoff
    if (status === 429) return true;

    // Server errors - temporary issues, should retry
    if (status >= 500 && status < 600) return true;

    // Client errors - permanent failures, don't retry
    if (status >= 400 && status < 500) return false;

    // Shouldn't reach here, but default to retryable for unknown status codes
    return true;
  }

  // Check for ClientDestroyedError from Undici
  if (error instanceof Error && 'code' in error && error.code === 'UND_ERR_DESTROYED') {
    return true; // This is retryable - connection pool issue
  }

  // Check for Undici socket errors (connection closed, reset, etc.)
  if (error instanceof Error && 'code' in error) {
    const errorWithCode = error as { code?: string };
    const code = errorWithCode.code;
    if (
      code === 'UND_ERR_SOCKET' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_BODY_TIMEOUT'
    ) {
      return true; // Socket errors are retryable
    }
  }

  // Check for "fetch failed" errors (usually have a cause with more details)
  if (error instanceof Error && error.message === 'fetch failed') {
    // Check the cause for more details
    const errorWithCause = error as { cause?: unknown };
    const cause = errorWithCause.cause;
    if (cause && typeof cause === 'object' && cause !== null) {
      // Socket errors in the cause are retryable
      if ('code' in cause) {
        const causeWithCode = cause as { code?: string; message?: string };
        const code = causeWithCode.code;
        if (
          code === 'UND_ERR_SOCKET' ||
          code === 'ECONNRESET' ||
          code === 'ECONNREFUSED' ||
          code === 'ETIMEDOUT'
        ) {
          return true;
        }
        // Check message for "other side closed" and similar
        const message = causeWithCode.message;
        if (message && typeof message === 'string') {
          const msg = message.toLowerCase();
          if (
            msg.includes('other side closed') ||
            msg.includes('connection reset') ||
            msg.includes('connection refused')
          ) {
            return true;
          }
        }
      }
    }
    return true; // Generic fetch failed - retry
  }

  // Network errors (ECONNREFUSED, ENOTFOUND, etc.) - should retry
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('network error') ||
      message.includes('socket') ||
      message.includes('connection')
    ) {
      return true;
    }
  }

  // Unknown errors - default to NOT retryable to avoid endless loops
  return false;
}

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
 * Intelligently skips retries for non-retryable errors (4xx client errors, timeouts, aborts)
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
        // Non-retryable error (e.g., 404, 400, 403, timeout, abort) - fail immediately
        const contextMsg = context ? ` [${context}]` : '';
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Only log abort/timeout errors at debug level to reduce noise
        if (isAbortError(error)) {
          // Suppress abort error logs - they're expected with timeouts
        } else if (error instanceof HttpError && error.status === 404) {
          // Concise 404 message with helpful hint
          console.error(`❌ Endpoint not found${contextMsg} - Check API_URL and endpoint paths in .env`);
        } else {
          console.log(`Non-retryable error${contextMsg} - ${errorMsg}`);
        }
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

      // Discover endpoint on first run or use cached/configured path
      if (!discoveredUserStatsPath) {
        const configuredPath = process.env.USER_STATS_ENDPOINT;
        if (configuredPath) {
          discoveredUserStatsPath = configuredPath;
          console.log(`Using configured user stats endpoint: ${configuredPath}`);
        } else {
          // Auto-discover using the first user address
          try {
            discoveredUserStatsPath = await discoverUserStatsEndpoint(apiUrl, headers, address);
          } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            throw new Error('Could not discover user stats endpoint');
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
          
          // On 404, clear cached path and try discovery again next time
          if (res.status === 404) {
            discoveredUserStatsPath = null;
          }
          
          // Throw HttpError with status code so retry logic can determine if it's retryable
          throw new HttpError(res.status, `HTTP ${res.status} ${errorDetail}`);
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
    }, 2, 200, `GET /users/${address}`); // Reduced from 6 to 2 retries

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
      console.log(`Deactivated user ${address} after ${CONFIG.MAX_FAILED_ATTEMPTS} failed attempts`);
    }
  }
}

// Cache for discovered endpoint paths
let discoveredPoolUsersPath: string | null = null;
let discoveredPoolStatsPath: string | null = null;
let discoveredUserStatsPath: string | null = null;

/**
 * Discover the correct pool users endpoint by trying common paths
 */
async function discoverPoolUsersEndpoint(apiUrl: string, headers: Record<string, string>): Promise<string> {
  const possiblePaths = [
    '/aggregator/pool/users',
    '/pool/users',
    '/api/pool/users',
    '/users',
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(`${apiUrl}${path}`, { 
        headers,
        timeout: 5000 
      });
      if (response.ok) {
        console.log(`✓ Discovered pool users endpoint: ${path}`);
        return path;
      }
    } catch {
      // Continue trying other paths
    }
  }

  throw new Error(
    `Could not find pool users endpoint. Tried: ${possiblePaths.join(', ')}. ` +
    `Please set POOL_USERS_ENDPOINT in your .env file.`
  );
}

/**
 * Discover the correct pool stats endpoint by trying common paths
 */
async function discoverPoolStatsEndpoint(apiUrl: string, headers: Record<string, string>): Promise<string> {
  const possiblePaths = [
    '/aggregator/pool/pool.status',
    '/pool/pool.status',
    '/api/pool/pool.status',
    '/pool.status',
    '/pool/status',
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(`${apiUrl}${path}`, { 
        headers,
        timeout: 5000 
      });
      if (response.ok) {
        console.log(`✓ Discovered pool stats endpoint: ${path}`);
        return path;
      }
    } catch {
      // Continue trying other paths
    }
  }

  throw new Error(
    `Could not find pool stats endpoint. Tried: ${possiblePaths.join(', ')}. ` +
    `Please set POOL_STATS_ENDPOINT in your .env file.`
  );
}

/**
 * Discover the correct user stats endpoint by trying common paths
 * @param address - A test user address to try
 */
async function discoverUserStatsEndpoint(
  apiUrl: string, 
  headers: Record<string, string>,
  address: string
): Promise<string> {
  const possiblePaths = [
    `/aggregator/users/${address}`,
    `/users/${address}`,
    `/api/users/${address}`,
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(`${apiUrl}${path}`, { 
        headers,
        timeout: 5000 
      });
      if (response.ok) {
        // Extract the base path without the address
        const basePath = path.replace(address, '{address}');
        console.log(`✓ Discovered user stats endpoint: ${basePath}`);
        return basePath;
      }
    } catch {
      // Continue trying other paths
    }
  }

  throw new Error(
    `Could not find user stats endpoint. Tried: ${possiblePaths.join(', ')}. ` +
    `Please set USER_STATS_ENDPOINT in your .env file.`
  );
}

/**
 * Collect stats for all monitored users
 */
async function collectAllUserStats() {
  if (isUserCollectorRunning) {
    console.log("⚠️  User stats collection already running, skipping this cycle");
    return;
  }

  try {
    isUserCollectorRunning = true;

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
        try {
          discoveredPoolUsersPath = await discoverPoolUsersEndpoint(apiUrl, headers);
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          return; // Skip this cycle
        }
      }
    }

    const poolUsersText = await withRetry(async () => {
      const response = await fetch(`${apiUrl}${discoveredPoolUsersPath}`, { headers });
      if (!response.ok) {
        // On 404, clear cached path and try discovery again next time
        if (response.status === 404) {
          discoveredPoolUsersPath = null;
        }
        throw new HttpError(response.status, `Failed to fetch pool users: ${response.statusText}`);
      }
      return response.text();
    }, 2, 500, `GET ${discoveredPoolUsersPath}`);

    // Parse pool users - handle both newline-delimited and JSON array formats
    let poolUsersArray: string[];
    const trimmedText = poolUsersText.trim();
    
    if (trimmedText.startsWith('[') && trimmedText.endsWith(']')) {
      // JSON array format
      try {
        poolUsersArray = JSON.parse(trimmedText) as string[];
      } catch (error) {
        console.error('Failed to parse pool users JSON:', error);
        poolUsersArray = [];
      }
    } else {
      // Newline-delimited format
      poolUsersArray = trimmedText.split('\n');
    }
    
    // Filter out empty, whitespace-only, or invalid addresses
    const poolUsers = new Set(
      poolUsersArray
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0 && addr !== '[]' && !addr.startsWith('['))
    );

    const db = getDb();
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

    const collectedCount = await processBatchedUserStats(usersToCollect);

    // Log summary
    const lifecycleChanges = addedCount + deactivatedCount + reactivatedCount;
    if (lifecycleChanges > 0) {
      console.log(`User lifecycle: ${addedCount} added, ${deactivatedCount} deactivated, ${reactivatedCount} reactivated`);
    }
    console.log(`Collected stats for ${collectedCount} users at ${new Date().toISOString()}`);

  } catch (error) {
    // Only log if it's not a 404 (404s are already logged by withRetry)
    if (!(error instanceof HttpError && error.status === 404)) {
      console.error("Error collecting user stats:", error);
    }
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
        throw new HttpError(response.status, `Failed to fetch pool stats: ${response.statusText}`);
      }
      return response.text();
    }, 2, 500, `GET ${discoveredPoolStatsPath}`);
    
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
    // Only log if it's not a 404 (404s are already logged by withRetry)
    if (!(error instanceof HttpError && error.status === 404)) {
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
