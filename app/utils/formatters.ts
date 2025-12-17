/**
 * Formats a number to always show 3 significant digits with appropriate unit suffix
 * e.g. 1234 -> 1.23K, 1234567 -> 1.23M, etc.
 */
export function formatDifficulty(value: number | string | undefined): string {
  if (!value) return '0';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (numValue === 0) return '0';
  
  const units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  const floor = Math.floor(Math.log10(numValue) / 3);
  const unitIndex = Math.min(floor, units.length - 1);
  
  const scaledValue = numValue / Math.pow(1000, unitIndex);
  
  // Always show 3 significant digits
  if (scaledValue >= 100) {
    return `${Math.round(scaledValue)}${units[unitIndex]}`;
  } else if (scaledValue >= 10) {
    return `${scaledValue.toFixed(1)}${units[unitIndex]}`;
  } else {
    return `${scaledValue.toFixed(2)}${units[unitIndex]}`;
  }
}

/**
 * Formats a hashrate value with appropriate unit suffix (H/s, KH/s, MH/s, etc.)
 * e.g. 1234 -> 1.23 KH/s, 1234567 -> 1.23 MH/s, etc.
 */
export function formatHashrate(value: number | string | undefined): string {
  if (!value) return '0 H/s';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (numValue === 0) return '0 H/s';
  
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s', 'ZH/s', 'YH/s'];
  const floor = Math.floor(Math.log10(numValue) / 3);
  const unitIndex = Math.min(floor, units.length - 1);
  
  const scaledValue = numValue / Math.pow(1000, unitIndex);
  
  // Always show 3 significant digits with space before unit
  if (scaledValue >= 100) {
    return `${Math.round(scaledValue)} ${units[unitIndex]}`;
  } else if (scaledValue >= 10) {
    return `${scaledValue.toFixed(1)} ${units[unitIndex]}`;
  } else {
    return `${scaledValue.toFixed(2)} ${units[unitIndex]}`;
  }
}

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
  const secondsToBlock = (difficulty * Math.pow(2, 32)) / hashrate;
  
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

/**
 * Formats a large number with compact suffixes (K, M, B, T)
 * e.g. 1234 -> 1.23K, 1234567890 -> 1.23B
 * Supports bigint for very large numbers
 */
export function formatCompactNumber(value: bigint | number): string {
  const num = typeof value === 'bigint' ? Number(value) : value;
  if (num === 0) return '0';

  const suffixes = ['', 'K', 'M', 'B', 'T', 'Q'];
  const absNum = Math.abs(num);

  if (absNum < 1000) {
    return num.toLocaleString();
  }

  const floor = Math.floor(Math.log10(absNum) / 3);
  const suffixIndex = Math.min(floor, suffixes.length - 1);

  const scaledValue = num / Math.pow(1000, suffixIndex);

  // Always show 4 significant digits
  if (Math.abs(scaledValue) >= 100) {
    return `${scaledValue.toFixed(1)}${suffixes[suffixIndex]}`;
  } else if (Math.abs(scaledValue) >= 10) {
    return `${scaledValue.toFixed(2)}${suffixes[suffixIndex]}`;
  } else {
    return `${scaledValue.toFixed(3)}${suffixes[suffixIndex]}`;
  }
}

/**
 * Converts a hashrate string with unit suffix back to its numerical value
 * e.g. '1.23KH/s' -> 1230, '1.23MH/s' -> 1230000
 */
export function parseHashrate(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  
  const units: { [key: string]: number } = {
    'Y': 24, 'Z': 21, 'E': 18, 'P': 15, 'T': 12, 'G': 9, 'M': 6, 'K': 3
  };
  
  // Remove '/s' suffix if present and trim
  const cleanValue = value.replace('/s', '').trim();
  
  // Extract the number and unit
  const match = cleanValue.match(/^([\d.]+)([YZEPMGTK])?$/);
  if (!match) return parseFloat(cleanValue);
  
  const [, numStr, unit] = match;
  const baseValue = parseFloat(numStr);
  
  if (!unit) return baseValue;
  return baseValue * Math.pow(10, units[unit]);
} 