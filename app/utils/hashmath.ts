export const HASHES_PER_DIFF_1 = 2 ** 32;
export const SECONDS_PER_DAY = 86_400;
export const HASH_DAYS_PER_PHD = 1e15;
export const HASHES_PER_THS = 1e12;
export const DIFFCHANGE_INTERVAL = 2016;
export const TARGET_BLOCK_SPACING = 600;
export const MIN_ORDER_HASHRATE_HPS = 299e12;

/** Slider granularity for the order hashrate control. */
export const HASHRATE_SLIDER_STEPS = 100;
export const HASHRATE_SLIDER_DEFAULT = HASHRATE_SLIDER_STEPS / 2;
// The router allows up to 24x the 24-hour target, i.e. a 1-hour minimum delivery.
export const MAX_TARGET_MULTIPLIER = 24;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hashWorkFromRate(hashrateHps: number, durationSeconds: number): number {
  return (hashrateHps * durationSeconds) / HASHES_PER_DIFF_1;
}

export function hashWorkToHashDays(workDiff1: number): number {
  return workDiff1 * (HASHES_PER_DIFF_1 / SECONDS_PER_DAY);
}

export function hashDaysToHashWork(hashDays: number): number {
  return hashDays * (SECONDS_PER_DAY / HASHES_PER_DIFF_1);
}

export function hashDaysFromPhd(phd: number): number {
  return phd * HASH_DAYS_PER_PHD;
}

export function phdFromHashDays(hashDays: number): number {
  return hashDays / HASH_DAYS_PER_PHD;
}

/** Delivery time for a fixed amount of work at a target hashrate. */
export function durationSecondsFromHashDaysAndRate(hashDays: number, hashrateHps: number): number {
  if (!Number.isFinite(hashDays) || !Number.isFinite(hashrateHps) || hashDays <= 0 || hashrateHps <= 0) {
    return 0;
  }
  return (hashDays * SECONDS_PER_DAY) / hashrateHps;
}

export function blocksUntilAdjustment(tip: number): number {
  return DIFFCHANGE_INTERVAL - (Math.max(0, Math.floor(tip)) % DIFFCHANGE_INTERVAL);
}

/** Maximum delivery window the router allows, in days. */
export function daysUntilAdjustment(tip: number): number {
  return Math.max(1, ((blocksUntilAdjustment(tip) - 1) * TARGET_BLOCK_SPACING) / SECONDS_PER_DAY);
}

/**
 * Minimum target hashrate for an order: the router's difficulty-adjustment
 * floor, but never below the 299 TH/s minimum-order floor. Without a tip we
 * can't know how much time is left before the next adjustment, so require the
 * safe 24-hour target instead: the 299 TH/s floor alone can be below the
 * router minimum for larger orders, which would only be rejected after
 * payment flow has started.
 */
export function minOrderHashrate(hashDays: number, tip?: number | null): number {
  if (!Number.isFinite(hashDays) || hashDays <= 0) return 0;
  if (tip == null || !Number.isFinite(tip) || tip < 0) {
    return hashDays;
  }
  const hardFloor = Math.min(MIN_ORDER_HASHRATE_HPS, hashDays);
  return Math.max(hardFloor, hashDays / daysUntilAdjustment(tip));
}

export function shareRate(hashrateHps: number, difficulty: number): number {
  return difficulty > 0 ? hashrateHps / (difficulty * HASHES_PER_DIFF_1) : 0;
}

export function orderTotal(hashPriceSatsPerPhd: number, hashDays: number): number {
  return Math.ceil((hashPriceSatsPerPhd * hashDays) / HASH_DAYS_PER_PHD);
}

const SI_PREFIXES = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
const HASHRATE_UNITS = SI_PREFIXES.map(prefix => `${prefix}H/s`);
const HASH_DAYS_UNITS = SI_PREFIXES.map(prefix => `${prefix}Hd`);

// Trailing zeros dropped: 12.00 -> "12", 2.50 -> "2.5".
const trimTrailingZeros = (value: number, decimals: number) => String(parseFloat(value.toFixed(decimals)));

function scale(value: number | string | undefined, units: readonly string[], separator: string, decimals = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!(numValue >= 1)) return units[0] ? `0${separator}${units[0]}` : '0';

  const unitIndex = Math.min(Math.floor(Math.log10(numValue) / 3), units.length - 1);
  const factor = 10 ** decimals;
  // The epsilon stops float error (1.15 * 100 = 114.999...) from truncating down.
  const truncated = Math.floor((numValue / 1000 ** unitIndex) * factor + 1e-9) / factor;
  const unit = units[unitIndex];

  return `${trimTrailingZeros(truncated, decimals)}${unit ? separator + unit : ''}`;
}

/** @example formatDifficulty(1.5e12) // "1.5T" */
export function formatDifficulty(value: number | string | undefined): string {
  return scale(value, SI_PREFIXES, '');
}

/** @example formatHashrate(1.5e15) // "1.5 PH/s" */
export function formatHashrate(value: number | string | undefined): string {
  return scale(value, HASHRATE_UNITS, ' ');
}

/** @example formatHashDays(3e15) // "3 PHd" */
export function formatHashDays(value: number | string | undefined): string {
  return scale(value, HASH_DAYS_UNITS, ' ');
}

/** @example formatHashWork(1.25e12) // "1.25 T" */
export function formatHashWork(value: number | string | undefined): string {
  return scale(value, SI_PREFIXES, ' ');
}

/** @example formatPercent(4.1234) // "4.12%" */
export function formatPercent(value: number | string | undefined): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(numValue)) return '0%';
  // Percentages aren't scaled, so 0.5% stays 0.5% rather than becoming 0%.
  const truncated = Math.trunc(numValue * 100 + Math.sign(numValue) * 1e-9) / 100;
  return `${trimTrailingZeros(truncated, 2)}%`;
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

// ---------------------------------------------------------------------------
// Order hashrate control: logarithmic slider mapping and whole-unit rounding.
// The slider is 0..HASHRATE_SLIDER_STEPS with the 24-hour default target at
// the midpoint, the floor (minimum order hashrate) at 0, and the router's
// maximum (24x the default) at the end.

/**
 * Slider position (0..HASHRATE_SLIDER_STEPS) for a target hashrate, given the
 * order's floor, default, and maximum rates.
 */
export function hashrateSliderPositionFor(
  hps: number,
  floorHps: number,
  defaultHps: number,
  maxHps: number,
): number {
  if (hps <= defaultHps) {
    if (defaultHps <= floorHps) return HASHRATE_SLIDER_DEFAULT;
    const ratio = Math.log(hps / floorHps) / Math.log(defaultHps / floorHps);
    return clamp(ratio * HASHRATE_SLIDER_DEFAULT, 0, HASHRATE_SLIDER_DEFAULT);
  }
  if (maxHps <= defaultHps) return HASHRATE_SLIDER_DEFAULT;
  const ratio = Math.log(hps / defaultHps) / Math.log(maxHps / defaultHps);
  return clamp(HASHRATE_SLIDER_DEFAULT + ratio * HASHRATE_SLIDER_DEFAULT, HASHRATE_SLIDER_DEFAULT, HASHRATE_SLIDER_STEPS);
}

/** Inverse of hashrateSliderPositionFor: target hashrate for a slider position. */
export function hashrateForSliderPosition(position: number, floorHps: number, defaultHps: number): number {
  if (position <= HASHRATE_SLIDER_DEFAULT) {
    if (defaultHps <= floorHps) return defaultHps;
    return floorHps * (defaultHps / floorHps) ** (position / HASHRATE_SLIDER_DEFAULT);
  }
  return defaultHps * MAX_TARGET_MULTIPLIER ** ((position - HASHRATE_SLIDER_DEFAULT) / HASHRATE_SLIDER_DEFAULT);
}

// Targets are rounded to whole TH/s below 1 PH/s and whole PH/s above it.

function hashrateWholeUnit(hps: number): number {
  return hps >= 1e15 ? 1e15 : HASHES_PER_THS;
}

export function roundHashrateToWholeUnit(hps: number): number {
  const unit = hashrateWholeUnit(hps);
  return Math.max(unit, Math.round(hps / unit) * unit);
}

export function ceilHashrateToWholeUnit(hps: number): number {
  const unit = hashrateWholeUnit(hps);
  return Math.max(unit, Math.ceil(hps / unit) * unit);
}

export function floorHashrateToWholeUnit(hps: number): number {
  const unit = hashrateWholeUnit(hps);
  return Math.max(unit, Math.floor(hps / unit) * unit);
}
