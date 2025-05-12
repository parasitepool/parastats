import cron from 'node-cron';
import { getDb } from './db';

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

/**
 * Helper function to add delay between retries
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper function with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const backoffDelay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`);
        await delay(backoffDelay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Fetch user stats and store them in the database
 */
async function collectUserStats(userId: number, address: string): Promise<void> {
  try {
    const response = await withRetry(async () => {
      const res = await fetch(`https://parasite.wtf/users/${address}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch user data: ${res.statusText}`);
      }
      return res;
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

      // Update monitored_users with latest bestever and authorised_at if they're higher
      // Also reset failed_attempts since we succeeded
      const updateStmt = db.prepare(`
        UPDATE monitored_users 
        SET 
          bestever = CASE WHEN bestever < ? THEN ? ELSE bestever END,
          authorised_at = CASE WHEN authorised_at < ? THEN ? ELSE authorised_at END,
          failed_attempts = 0,
          updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        userData.bestever,
        userData.bestever,
        userData.authorised,
        userData.authorised,
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

      // If we hit 10 failures, deactivate and reset counter, otherwise just increment
      updateStmt.run(
        newFailedAttempts >= 10 ? 0 : newFailedAttempts,
        newFailedAttempts >= 10 ? 0 : 1,
        now,
        userId
      );
    })();
  }
}

/**
 * Fetch stats for all monitored users
 */
export async function collectAllUserStats() {
  if (isUserCollectorRunning) return;

  try {
    isUserCollectorRunning = true;
    const db = getDb();

    // Get all active monitored users
    const users = db.prepare('SELECT id, address FROM monitored_users WHERE is_active = 1').all() as MonitoredUser[];

    // Collect stats for all users in parallel
    await Promise.allSettled(
      users.map(user => collectUserStats(user.id, user.address))
    );

    console.log(`Collected stats for ${users.length} users at ${new Date().toISOString()}`);

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
      const response = await fetch("https://parasite.wtf/pool/pool.status");
      return response.text();
    });
    
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

  // Run user stats collection every minute
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
