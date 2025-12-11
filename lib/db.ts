import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure the data directory exists - configurable via environment variable
const dataDir = process.env.PARASTATS_DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pool-stats.db');

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // Create tables if they don't exist
    initializeTables();
  }
  return db;
}

function initializeTables() {
  const db = getDb();
  
  // Create pool stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pool_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      runtime INTEGER NOT NULL,
      users INTEGER NOT NULL,
      workers INTEGER NOT NULL,
      idle INTEGER NOT NULL,
      disconnected INTEGER NOT NULL,
      hashrate1m TEXT NOT NULL,
      hashrate5m TEXT NOT NULL,
      hashrate15m TEXT NOT NULL,
      hashrate1hr TEXT NOT NULL,
      hashrate6hr TEXT NOT NULL,
      hashrate1d TEXT NOT NULL,
      hashrate7d TEXT NOT NULL
    )
  `);
  
  // Create index on timestamp for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pool_stats_timestamp ON pool_stats(timestamp)
  `);

  // Create monitored users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT UNIQUE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      is_public BOOLEAN NOT NULL DEFAULT 1,
      bestever REAL DEFAULT 0,
      authorised_at INTEGER DEFAULT 0,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Add failed_attempts column if it doesn't exist since we added this field later
  try {
    db.exec(`ALTER TABLE monitored_users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0`);
  } catch (error: unknown) {
    // Column might already exist, which is fine
    if (error instanceof Error && !error.message.includes('duplicate column name')) {
      console.error('Error adding failed_attempts column:', error);
    }
  }

  // Add total_blocks column for loyalty ranking based on blocks mined
  try {
    db.exec(`ALTER TABLE monitored_users ADD COLUMN total_blocks INTEGER NOT NULL DEFAULT 0`);
  } catch (error: unknown) {
    // Column might already exist, which is fine
    if (error instanceof Error && !error.message.includes('duplicate column name')) {
      console.error('Error adding total_blocks column:', error);
    }
  }

  // Create index on address for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_users_address ON monitored_users(address)
  `);

  // Create index on is_active for efficient filtering during collection
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_users_active ON monitored_users(is_active)
  `);

  // Create user stats history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      hashrate1m TEXT NOT NULL,
      hashrate5m TEXT NOT NULL,
      hashrate1hr TEXT NOT NULL,
      hashrate1d TEXT NOT NULL,
      hashrate7d TEXT NOT NULL,
      workers INTEGER NOT NULL,
      bestshare REAL NOT NULL,
      bestever REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES monitored_users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for efficient querying of historical data
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_stats_user_time ON user_stats_history(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_user_stats_created_at ON user_stats_history(created_at);
  `);

  // Create stratum notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stratum_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      pool TEXT NOT NULL,
      job_id TEXT NOT NULL,
      prev_block_hash TEXT NOT NULL,
      coinbase1 TEXT NOT NULL,
      coinbase2 TEXT NOT NULL,
      merkle_branches TEXT NOT NULL,
      version TEXT NOT NULL,
      n_bits TEXT NOT NULL,
      n_time TEXT NOT NULL,
      clean_jobs BOOLEAN NOT NULL,
      extranonce1 TEXT,
      extranonce2_size INTEGER,
      raw_message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(notification_id)
    )
  `);

  // Create indexes for efficient querying of stratum data
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stratum_timestamp ON stratum_notifications(timestamp);
    CREATE INDEX IF NOT EXISTS idx_stratum_pool ON stratum_notifications(pool);
  `);
}

// Close the database connection when the app is shutting down
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
