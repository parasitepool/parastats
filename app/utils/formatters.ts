import { HASHES_PER_DIFF_1 } from './hashmath';

export function formatPrice(price: number | null): string {
  if (price === null) return "Loading...";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: price < 1000 ? 2 : 0
  }).format(price);
};

export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

export function formatRelativeTime(timestamp: number): string {
  // 0 is the pool's "never submitted" sentinel; callers may also pass NaN from a
  // missing lastshare. Both would otherwise render as a date near the epoch.
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';

  const now = new Date();
  const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds

  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Calculate actual month difference, accounting for day of month
  let monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

  // Adjust if we haven't reached the same day of the month yet
  // For months with fewer days, use the last day of the current month as the anniversary
  const lastDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const effectiveAnniversaryDay = Math.min(date.getDate(), lastDayOfCurrentMonth);

  if (now.getDate() < effectiveAnniversaryDay) {
    monthDiff--;
  }

  // Calculate years from months
  const yearDiff = Math.floor(monthDiff / 12);

  if (yearDiff > 0) return `${yearDiff}y ago`;
  if (monthDiff > 0) return `${monthDiff}mo ago`;
  if (diffDays > 6) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return `${diffSeconds}s ago`;
}

/**
 * Relative time with a seconds component for the first hour. Used by the
 * live template counter so the age visibly ticks every second.
 */
export function formatPreciseRelativeTime(
  timestamp: number,
  nowMs: number = Date.now(),
): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';

  const totalSeconds = Math.max(0, Math.floor((nowMs - timestamp * 1000) / 1000));

  if (totalSeconds < 1) return 'just now';
  if (totalSeconds < 60) return `${totalSeconds}s ago`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s ago`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

/**
 * Calculates and formats the estimated time to find a block based on pool hashrate and network difficulty
 * Formula: Time = (Difficulty × 2^32) / Hashrate
 * @param poolHashrate - Pool's hashrate in H/s
 * @param networkDifficulty - Current network difficulty
 * @returns Formatted string with estimated time
 */
export function formatExpectedBlockTime(poolHashrate: number | string | undefined, networkDifficulty: number | string | undefined): string {
  if (!poolHashrate || !networkDifficulty) return 'N/A';
  
  const hashrate = typeof poolHashrate === 'string' ? parseFloat(poolHashrate) : poolHashrate;
  const difficulty = typeof networkDifficulty === 'string' ? parseFloat(networkDifficulty) : networkDifficulty;
  
  if (hashrate === 0 || difficulty === 0) return 'N/A';
  
  // Calculate seconds to find a block
  // Time = (Difficulty × 2^32) / Hashrate
  const secondsToBlock = (difficulty * HASHES_PER_DIFF_1) / hashrate;
  
  // Convert to appropriate time unit
  const SECONDS_IN_YEAR = 31536000; // 365 days
  const SECONDS_IN_DAY = 86400;
  const SECONDS_IN_HOUR = 3600;
  const SECONDS_IN_MINUTE = 60;

  if (secondsToBlock >= SECONDS_IN_YEAR) {
    const years = Math.floor(secondsToBlock / SECONDS_IN_YEAR);
    const days = Math.floor((secondsToBlock % SECONDS_IN_YEAR) / SECONDS_IN_DAY);
    return days > 0 ? `${years}y ${days}d` : `${years}y`;
  } else if (secondsToBlock >= SECONDS_IN_DAY) {
    const days = Math.floor(secondsToBlock / SECONDS_IN_DAY);
    const hours = Math.round((secondsToBlock % SECONDS_IN_DAY) / SECONDS_IN_HOUR);
    return `${days}d ${hours}h`;
  } else if (secondsToBlock >= SECONDS_IN_HOUR) {
    const hours = Math.floor(secondsToBlock / SECONDS_IN_HOUR);
    const minutes = Math.round((secondsToBlock % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE);
    return `${hours}h ${minutes}m`;
  } else if (secondsToBlock >= SECONDS_IN_MINUTE) {
    return `${Math.round(secondsToBlock / SECONDS_IN_MINUTE)}m`;
  } else {
    return `${Math.round(secondsToBlock)}s`;
  }
}
