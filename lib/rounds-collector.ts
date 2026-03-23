import cron from 'node-cron';
import { getDb } from './db';
import { fetch, HttpError, isRetryableError } from './http-client';

// Types for API responses
interface Round {
  blockheight: number;
  blockhash: string;
  coinbasevalue?: number;
  diff?: number;
  username?: string;
}

interface RoundParticipant {
  username: string;
  blocks_participated: number;
  top_diff: number;
}

// Configuration
const CONFIG = {
  MAX_RETRIES: 4,
  RETRY_BASE_DELAY: 500,
  CURRENT_ROUND_POLL_INTERVAL: '*/10 * * * *', // every 10 minutes
  CURRENT_ROUND_TIMEOUT: 30_000,
  PARTICIPANT_FETCH_TIMEOUT: 300_000, // 5 minutes
  PARTICIPANT_REFETCH_COOLDOWN: 360_000, // 6 minutes - skip re-trigger if fetched recently
  ROUNDS_SYNC_INTERVAL: '*/10 * * * *', // every 10 minutes
} as const;

let isCollectingCurrent = false;
let isSyncingRounds = false;
let isFetchingPendingParticipants = false;
let syncJob: ReturnType<typeof cron.schedule> | null = null;
let currentRoundJob: ReturnType<typeof cron.schedule> | null = null;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper with backoff and jitter
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

      if (!isRetryableError(error)) {
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

function getApiHeaders(): { url: string; headers: Record<string, string> } {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error('No API_URL defined in env');
  }
  const headers: Record<string, string> = {};
  if (process.env.API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
  }
  return { url: apiUrl, headers };
}

/**
 * Fetch the list of all completed rounds from the pool API
 */
async function fetchRoundsList(): Promise<Round[]> {
  const { url: apiUrl, headers } = getApiHeaders();

  return withRetry(async () => {
    const url = `${apiUrl}/rounds`;
    const response = await fetch(url, { headers, timeout: 10_000 });

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url);
    }

    return await response.json() as Round[];
  }, 'GET /rounds');
}

/**
 * Fetch current round participants from the pool API
 */
async function fetchCurrentRound(): Promise<RoundParticipant[]> {
  const { url: apiUrl, headers } = getApiHeaders();

  return withRetry(async () => {
    const url = `${apiUrl}/rounds/current`;
    const response = await fetch(url, { headers, timeout: CONFIG.CURRENT_ROUND_TIMEOUT });

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url);
    }

    return await response.json() as RoundParticipant[];
  }, 'GET /rounds/current');
}

/**
 * Fetch block participants (users who submitted shares at the exact block height)
 */
async function fetchBlockParticipantsFromApi(blockHeight: number): Promise<string[]> {
  const { url: apiUrl, headers } = getApiHeaders();

  return withRetry(async () => {
    const url = `${apiUrl}/participants/${blockHeight}`;
    const response = await fetch(url, { headers, timeout: CONFIG.PARTICIPANT_FETCH_TIMEOUT });

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url);
    }

    return await response.json() as string[];
  }, `GET /participants/${blockHeight}`);
}

/**
 * Fetch participants for a completed round from the pool API
 */
async function fetchRoundParticipantsFromApi(blockHeight: number): Promise<RoundParticipant[]> {
  const { url: apiUrl, headers } = getApiHeaders();

  return withRetry(async () => {
    const url = `${apiUrl}/rounds/${blockHeight}`;
    const response = await fetch(url, { headers, timeout: CONFIG.PARTICIPANT_FETCH_TIMEOUT });

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, url);
    }

    return await response.json() as RoundParticipant[];
  }, `GET /rounds/${blockHeight}`);
}

/**
 * Sync round list: fetch GET /rounds and upsert metadata into DB.
 * Returns the number of new rounds found.
 */
export async function syncRounds(): Promise<number> {
  if (isSyncingRounds) {
    console.warn('Rounds sync already running, skipping');
    return 0;
  }

  try {
    isSyncingRounds = true;
    const rounds = await fetchRoundsList();
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const insertNew = db.prepare(`
      INSERT INTO rounds (block_height, block_hash, coinbase_value, winner_diff, winner_username, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(block_height) DO UPDATE SET
        block_hash = excluded.block_hash,
        coinbase_value = excluded.coinbase_value,
        winner_diff = excluded.winner_diff,
        winner_username = excluded.winner_username
    `);

    const existingHeights = new Set(
      (db.prepare('SELECT block_height FROM rounds').all() as { block_height: number }[])
        .map(r => r.block_height)
    );

    let newRounds = 0;

    db.transaction(() => {
      for (const round of rounds) {
        if (!existingHeights.has(round.blockheight)) newRounds++;
        insertNew.run(
          round.blockheight,
          round.blockhash,
          round.coinbasevalue ?? null,
          round.diff ?? null,
          round.username ?? null,
          now
        );
      }
    })();

    if (newRounds > 0) {
      console.log(`🔄 Synced ${rounds.length} rounds (${newRounds} new)`);
    }

    return newRounds;
  } catch (error) {
    console.error('Error syncing rounds:', error);
    return 0;
  } finally {
    isSyncingRounds = false;
  }
}

/**
 * Collect current round participant data.
 * Replaces all block_height=0 rows with fresh data.
 */
export async function collectCurrentRound(): Promise<void> {
  if (isCollectingCurrent) {
    console.warn('Current round collection already running, skipping');
    return;
  }

  try {
    isCollectingCurrent = true;
    const participants = await fetchCurrentRound();
    const db = getDb();

    db.transaction(() => {
      db.prepare('DELETE FROM round_participants WHERE block_height = 0').run();

      const insert = db.prepare(`
        INSERT INTO round_participants (block_height, username, top_diff, blocks_participated)
        VALUES (0, ?, ?, ?)
      `);

      for (const p of participants) {
        insert.run(p.username, p.top_diff, p.blocks_participated);
      }
    })();

    console.log(`🔄 Current round: ${participants.length} participants`);
  } catch (error) {
    console.error('Error collecting current round:', error);
  } finally {
    isCollectingCurrent = false;
  }
}

/**
 * Fetch and cache participants for completed rounds that are pending or errored.
 * Runs async, never blocks cron cycle.
 */
export async function fetchPendingRoundParticipants(): Promise<void> {
  if (isFetchingPendingParticipants) {
    console.warn('Pending participant fetch already running, skipping');
    return;
  }

  isFetchingPendingParticipants = true;
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const pendingRounds = db.prepare(`
      SELECT block_height, participant_status, participant_fetched_at
      FROM rounds
      WHERE participant_status IN ('pending', 'error', 'fetching')
      ORDER BY block_height ASC
    `).all() as { block_height: number; participant_status: string; participant_fetched_at: number | null }[];

    for (const round of pendingRounds) {
      // Skip if recently attempted (prevent double-fetches on restart)
      if (round.participant_fetched_at && (now - round.participant_fetched_at) < CONFIG.PARTICIPANT_REFETCH_COOLDOWN / 1000) {
        continue;
      }

      const blockHeight = round.block_height;

      // Mark as fetching
      db.prepare('UPDATE rounds SET participant_status = ?, participant_fetched_at = ? WHERE block_height = ?')
        .run('fetching', now, blockHeight);

      try {
        const participants = await fetchRoundParticipantsFromApi(blockHeight);

        db.transaction(() => {
          // Clear any existing data for this round
          db.prepare('DELETE FROM round_participants WHERE block_height = ?').run(blockHeight);

          const insert = db.prepare(`
            INSERT INTO round_participants (block_height, username, top_diff, blocks_participated)
            VALUES (?, ?, ?, ?)
          `);

          for (const p of participants) {
            insert.run(blockHeight, p.username, p.top_diff, p.blocks_participated);
          }

          db.prepare('UPDATE rounds SET participant_status = ?, error_message = NULL WHERE block_height = ?')
            .run('complete', blockHeight);
        })();

        console.log(`✅ Round ${blockHeight}: ${participants.length} participants cached`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        db.prepare('UPDATE rounds SET participant_status = ?, error_message = ? WHERE block_height = ?')
          .run('error', errorMsg, blockHeight);
        console.error(`❌ Round ${blockHeight} participant fetch failed: ${errorMsg}`);
      }
    }

    // Fetch block participants for rounds that have completed round-participant fetch
    const pendingBlockParticipants = db.prepare(`
      SELECT block_height, block_participant_status, block_participant_fetched_at
      FROM rounds
      WHERE block_participant_status IN ('pending', 'error', 'fetching')
        AND participant_status = 'complete'
      ORDER BY block_height ASC
    `).all() as { block_height: number; block_participant_status: string; block_participant_fetched_at: number | null }[];

    for (const round of pendingBlockParticipants) {
      if (round.block_participant_fetched_at && (now - round.block_participant_fetched_at) < CONFIG.PARTICIPANT_REFETCH_COOLDOWN / 1000) {
        continue;
      }

      const blockHeight = round.block_height;

      db.prepare('UPDATE rounds SET block_participant_status = ?, block_participant_fetched_at = ? WHERE block_height = ?')
        .run('fetching', now, blockHeight);

      try {
        const usernames = await fetchBlockParticipantsFromApi(blockHeight);

        db.transaction(() => {
          db.prepare('DELETE FROM block_participants WHERE block_height = ?').run(blockHeight);

          const insert = db.prepare(`
            INSERT INTO block_participants (block_height, username)
            VALUES (?, ?)
          `);

          for (const username of usernames) {
            insert.run(blockHeight, username);
          }

          db.prepare('UPDATE rounds SET block_participant_status = ?, error_message = NULL WHERE block_height = ?')
            .run('complete', blockHeight);
        })();

        console.log(`✅ Block ${blockHeight}: ${usernames.length} block participants cached`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        db.prepare('UPDATE rounds SET block_participant_status = ?, error_message = ? WHERE block_height = ?')
          .run('error', errorMsg, blockHeight);
        console.error(`❌ Block ${blockHeight} participant fetch failed: ${errorMsg}`);
      }
    }
  } finally {
    isFetchingPendingParticipants = false;
  }
}

/**
 * Trigger a re-sync of rounds (e.g. from stratum clean_jobs)
 */
export function triggerRoundsSync(): void {
  syncRounds()
    .then(newRounds => {
      if (newRounds > 0) {
        // New round detected — fetch participants in background
        fetchPendingRoundParticipants().catch(err =>
          console.error('Error fetching pending round participants:', err)
        );
      }
    })
    .catch(err => console.error('Error in triggered rounds sync:', err));
}

/**
 * Start the rounds collector:
 * - Sync round list on startup
 * - Collect current round data on startup
 * - Fetch pending round participants on startup
 * - Schedule periodic polling
 */
export function startRoundsCollector(): void {
  // Startup: sync rounds, collect current, fetch pending participants
  syncRounds()
    .then(() => {
      // After syncing rounds, fetch any pending participant data in background
      fetchPendingRoundParticipants().catch(err =>
        console.error('Error fetching pending round participants on startup:', err)
      );
    })
    .catch(err => console.error('Error syncing rounds on startup:', err));

  collectCurrentRound().catch(err =>
    console.error('Error collecting current round on startup:', err)
  );

  // Schedule periodic round list sync + retry any pending/errored participants
  syncJob = cron.schedule(CONFIG.ROUNDS_SYNC_INTERVAL, async () => {
    await syncRounds();
    fetchPendingRoundParticipants().catch(err =>
      console.error('Error fetching pending round participants:', err)
    );
  });

  // Schedule current round polling
  currentRoundJob = cron.schedule(CONFIG.CURRENT_ROUND_POLL_INTERVAL, async () => {
    await collectCurrentRound();
  });

  console.log('🔄 Rounds collector started (sync + current round polling every 10 minutes)');
}

/**
 * Stop the rounds collector and clear scheduled jobs
 */
export function stopRoundsCollector(): void {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
  }
  if (currentRoundJob) {
    currentRoundJob.stop();
    currentRoundJob = null;
  }
  isCollectingCurrent = false;
  isSyncingRounds = false;
  isFetchingPendingParticipants = false;
  console.log('🔄 Rounds collector stopped');
}
