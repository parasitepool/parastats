/**
 * Type definitions and type guards for pool stats data structures
 * 
 * This module contains all interfaces, types, and validation functions
 * for working with mining pool data from various API endpoints.
 */

/**
 * Pool statistics data (users, workers, shares)
 */
export interface StatsData {
  Users?: number;
  users?: number;
  Workers?: number;
  workers?: number;
  [key: string]: unknown;
}

/**
 * Hashrate data from pool
 */
export interface HashrateData {
  hashrate15m?: string;
  Hashrate15m?: string;
  [key: string]: unknown;
}

/**
 * Difficulty/bestshare data from pool
 */
export interface DifficultyData {
  bestshare?: number;
  Bestshare?: number;
  [key: string]: unknown;
}

/**
 * Individual user statistics from the pool
 */
export interface UserData {
  address: string;
  hashrate15m?: string;
  shares?: number;
  bestshare?: number;
  [key: string]: unknown;
}

/**
 * Monitored user configuration
 */
export interface MonitoredUser {
  id: number;
  address: string;
}

/**
 * Helper to get a value from an object with case-insensitive key matching
 * 
 * Tries multiple case variations of the key:
 * 1. Exact match
 * 2. Lowercase
 * 3. Capitalized (first letter uppercase)
 * 4. Uppercase
 * 
 * @example
 * const obj = { Users: 42 };
 * getCaseInsensitive(obj, 'users') // Returns 42
 */
export function getCaseInsensitive(
  obj: Record<string, unknown>,
  key: string
): unknown {
  // Try exact match first
  if (key in obj) return obj[key];

  // Try lowercase
  const lowerKey = key.toLowerCase();
  if (lowerKey in obj) return obj[lowerKey];

  // Try uppercase first letter
  const capitalKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
  if (capitalKey in obj) return obj[capitalKey];

  // Try all uppercase
  const upperKey = key.toUpperCase();
  if (upperKey in obj) return obj[upperKey];

  return undefined;
}

/**
 * Type guard to validate StatsData structure
 */
export function isStatsData(obj: unknown): obj is StatsData {
  if (typeof obj !== 'object' || obj === null) return false;

  const data = obj as Record<string, unknown>;

  // Check if either Users or users exists and is a number
  const users =
    getCaseInsensitive(data, 'Users') ?? getCaseInsensitive(data, 'users');
  if (typeof users !== 'number') return false;

  // Check if either Workers or workers exists and is a number
  const workers =
    getCaseInsensitive(data, 'Workers') ??
    getCaseInsensitive(data, 'workers');
  if (typeof workers !== 'number') return false;

  return true;
}

/**
 * Type guard to validate HashrateData structure
 */
export function isHashrateData(obj: unknown): obj is HashrateData {
  if (typeof obj !== 'object' || obj === null) return false;

  const data = obj as Record<string, unknown>;

  // Check if hashrate15m exists in any case variation
  const hashrate = getCaseInsensitive(data, 'hashrate15m');
  if (typeof hashrate !== 'string') return false;

  return true;
}

/**
 * Type guard to validate DifficultyData structure
 */
export function isDifficultyData(obj: unknown): obj is DifficultyData {
  if (typeof obj !== 'object' || obj === null) return false;

  const data = obj as Record<string, unknown>;

  // Check if bestshare exists in any case variation
  const bestshare = getCaseInsensitive(data, 'bestshare');
  if (typeof bestshare !== 'number') return false;

  return true;
}

/**
 * Type guard to validate UserData structure
 */
export function isUserData(obj: unknown): obj is UserData {
  if (typeof obj !== 'object' || obj === null) return false;

  const data = obj as Record<string, unknown>;

  // Address is required
  const address = getCaseInsensitive(data, 'address');
  if (typeof address !== 'string') return false;

  // Other fields are optional but should be validated if present
  const hashrate = getCaseInsensitive(data, 'hashrate15m');
  if (hashrate !== undefined && typeof hashrate !== 'string') return false;

  const shares = getCaseInsensitive(data, 'shares');
  if (shares !== undefined && typeof shares !== 'number') return false;

  const bestshare = getCaseInsensitive(data, 'bestshare');
  if (bestshare !== undefined && typeof bestshare !== 'number') return false;

  return true;
}

/**
 * Extract Users count from StatsData with case-insensitive matching
 */
export function extractUsers(data: StatsData): number {
  const users =
    getCaseInsensitive(data, 'Users') ?? getCaseInsensitive(data, 'users');
  if (typeof users !== 'number') {
    throw new Error('Missing or invalid Users field in StatsData');
  }
  return users;
}

/**
 * Extract Workers count from StatsData with case-insensitive matching
 */
export function extractWorkers(data: StatsData): number {
  const workers =
    getCaseInsensitive(data, 'Workers') ??
    getCaseInsensitive(data, 'workers');
  if (typeof workers !== 'number') {
    throw new Error('Missing or invalid Workers field in StatsData');
  }
  return workers;
}

/**
 * Extract hashrate from HashrateData with case-insensitive matching
 */
export function extractHashrate(data: HashrateData): string {
  const hashrate = getCaseInsensitive(data, 'hashrate15m');
  if (typeof hashrate !== 'string') {
    throw new Error('Missing or invalid hashrate15m field in HashrateData');
  }
  return hashrate;
}

/**
 * Extract bestshare from DifficultyData with case-insensitive matching
 */
export function extractBestshare(data: DifficultyData): number {
  const bestshare = getCaseInsensitive(data, 'bestshare');
  if (typeof bestshare !== 'number') {
    throw new Error('Missing or invalid bestshare field in DifficultyData');
  }
  return bestshare;
}
