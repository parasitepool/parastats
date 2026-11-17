import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HASHES_PER_THS,
  HASHRATE_SLIDER_DEFAULT,
  HASHRATE_SLIDER_STEPS,
  HASH_DAYS_PER_PHD,
  HASHES_PER_DIFF_1,
  MAX_TARGET_MULTIPLIER,
  MIN_ORDER_HASHRATE_HPS,
  SECONDS_PER_DAY,
  blocksUntilAdjustment,
  ceilHashrateToWholeUnit,
  clamp,
  daysUntilAdjustment,
  floorHashrateToWholeUnit,
  formatDifficulty,
  formatHashDays,
  formatHashWork,
  formatHashrate,
  formatPercent,
  durationSecondsFromHashDaysAndRate,
  hashDaysFromPhd,
  hashDaysToHashWork,
  hashrateForSliderPosition,
  hashrateSliderPositionFor,
  hashWorkFromRate,
  hashWorkToHashDays,
  minOrderHashrate,
  orderTotal,
  parseHashrate,
  phdFromHashDays,
  roundHashrateToWholeUnit,
  shareRate,
} from './hashmath';

test('work and hash-day conversions', () => {
  const work = hashWorkFromRate(HASH_DAYS_PER_PHD, SECONDS_PER_DAY);
  assert.equal(work, (HASH_DAYS_PER_PHD * SECONDS_PER_DAY) / HASHES_PER_DIFF_1);
  assert.equal(hashWorkToHashDays(work), HASH_DAYS_PER_PHD);
  assert.equal(hashDaysToHashWork(HASH_DAYS_PER_PHD), work);
  assert.equal(hashDaysFromPhd(1.25), 1.25e15);
  assert.equal(phdFromHashDays(1.25e15), 1.25);
});

test('share rate', () => {
  assert.equal(shareRate(HASHES_PER_DIFF_1, 1), 1);
  assert.equal(shareRate(HASHES_PER_DIFF_1, 0), 0);
});

test('order payment rounding', () => {
  assert.equal(orderTotal(50_000, hashDaysFromPhd(1)), 50_000);
  assert.equal(orderTotal(1_001, hashDaysFromPhd(0.5)), 501);
  assert.equal(orderTotal(1_000, hashDaysFromPhd(0.001)), 1);
});

test('display formatting', () => {
  assert.equal(formatDifficulty(1.5e12), '1.5T');
  assert.equal(formatDifficulty(1.15e12), '1.15T');
  assert.equal(formatDifficulty('2.5e9'), '2.5G');
  assert.equal(formatDifficulty(0), '0');
  assert.equal(formatDifficulty(undefined), '0');

  assert.equal(formatHashrate(1.5e15), '1.5 PH/s');
  assert.equal(formatHashrate(0), '0 H/s');

  assert.equal(formatHashDays(3e15), '3 PHd');
  assert.equal(formatHashDays(0.5), '0 Hd');

  assert.equal(formatHashWork(1e12), '1 T');
  assert.equal(formatHashWork(1.25e12), '1.25 T');
  assert.equal(formatHashWork(1.999e12), '1.99 T');
  assert.equal(formatHashWork(5), '5');
  assert.equal(formatHashWork(20.12e9), '20.12 G');
  assert.equal(formatHashWork(0), '0');
});

test('percent formatting', () => {
  assert.equal(formatPercent(4.1234), '4.12%');
  assert.equal(formatPercent(4), '4%');
  assert.equal(formatPercent(0.5), '0.5%');
  assert.equal(formatPercent(-1.155), '-1.15%');
  assert.equal(formatPercent(undefined), '0%');
});

test('scaled value parsing', () => {
  assert.equal(parseHashrate('1.5T'), 1.5e12);
  assert.equal(parseHashrate('2K'), 2000);
  assert.equal(parseHashrate(42), 42);
});

test('duration from work and target hashrate', () => {
  assert.equal(durationSecondsFromHashDaysAndRate(1e15, 1e15), SECONDS_PER_DAY);
  assert.equal(durationSecondsFromHashDaysAndRate(1e15, 2e15), SECONDS_PER_DAY / 2);
  assert.equal(durationSecondsFromHashDaysAndRate(0, 1e15), 0);
  assert.equal(durationSecondsFromHashDaysAndRate(1e15, 0), 0);
});

test('difficulty adjustment hashrate floor', () => {
  const minOrderHashDays = 0.299 * HASH_DAYS_PER_PHD;
  const epochStartDays = (2015 * 600) / SECONDS_PER_DAY;

  assert.equal(blocksUntilAdjustment(0), 2016);
  assert.equal(blocksUntilAdjustment(2015), 1);
  assert.equal(blocksUntilAdjustment(2016), 2016);
  assert.equal(daysUntilAdjustment(0), epochStartDays);
  assert.equal(daysUntilAdjustment(2015), 1);

  assert.equal(minOrderHashrate(minOrderHashDays, 2015), minOrderHashDays);
  assert.equal(minOrderHashrate(minOrderHashDays, 0), MIN_ORDER_HASHRATE_HPS);
  assert.equal(minOrderHashrate(1e15, 0), MIN_ORDER_HASHRATE_HPS);
  // Without a tip, require the safe 24-hour target: the 299 TH/s floor
  // alone could be below the router minimum for larger orders.
  assert.equal(minOrderHashrate(minOrderHashDays, null), minOrderHashDays);
  assert.equal(minOrderHashrate(1e15, null), 1e15);

  const largeOrderHashDays = 10 * HASH_DAYS_PER_PHD;
  assert.equal(minOrderHashrate(largeOrderHashDays, 0), largeOrderHashDays / epochStartDays);
  assert.ok(minOrderHashrate(largeOrderHashDays, 0) > MIN_ORDER_HASHRATE_HPS);
  assert.equal(minOrderHashrate(largeOrderHashDays, null), largeOrderHashDays);
});

test('value clamping', () => {
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(3, 1, 1), 1);
});

test('hashrate slider mapping', () => {
  const floorHps = MIN_ORDER_HASHRATE_HPS;
  const defaultHps = HASH_DAYS_PER_PHD;
  const maxHps = defaultHps * MAX_TARGET_MULTIPLIER;

  // The default target sits at the midpoint, the floor at 0, the max at the end.
  assert.equal(hashrateSliderPositionFor(defaultHps, floorHps, defaultHps, maxHps), HASHRATE_SLIDER_DEFAULT);
  assert.equal(hashrateSliderPositionFor(floorHps, floorHps, defaultHps, maxHps), 0);
  assert.equal(hashrateSliderPositionFor(maxHps, floorHps, defaultHps, maxHps), HASHRATE_SLIDER_STEPS);

  // Out-of-range rates clamp to the slider bounds.
  assert.equal(hashrateSliderPositionFor(floorHps / 2, floorHps, defaultHps, maxHps), 0);
  assert.equal(hashrateSliderPositionFor(maxHps * 2, floorHps, defaultHps, maxHps), HASHRATE_SLIDER_STEPS);

  // The inverse mapping hits the same landmarks.
  assert.equal(hashrateForSliderPosition(0, floorHps, defaultHps), floorHps);
  assert.equal(hashrateForSliderPosition(HASHRATE_SLIDER_DEFAULT, floorHps, defaultHps), defaultHps);
  assert.equal(hashrateForSliderPosition(HASHRATE_SLIDER_STEPS, floorHps, defaultHps), maxHps);

  // Degenerate bounds collapse to the default position/rate.
  assert.equal(hashrateSliderPositionFor(defaultHps, defaultHps, defaultHps, maxHps), HASHRATE_SLIDER_DEFAULT);
  assert.equal(hashrateForSliderPosition(0, defaultHps, defaultHps), defaultHps);

  // The two mappings are inverses of each other across the range.
  for (let position = 0; position <= HASHRATE_SLIDER_STEPS; position += 5) {
    const hps = hashrateForSliderPosition(position, floorHps, defaultHps);
    const roundTrip = hashrateSliderPositionFor(hps, floorHps, defaultHps, maxHps);
    assert.ok(Math.abs(roundTrip - position) < 1e-6, `position ${position} round tripped to ${roundTrip}`);
  }
});

test('whole-unit hashrate rounding', () => {
  // Below 1 PH/s, targets round to whole TH/s (never zero).
  assert.equal(roundHashrateToWholeUnit(1.5e12), 2 * HASHES_PER_THS);
  assert.equal(roundHashrateToWholeUnit(0.4e12), HASHES_PER_THS);
  assert.equal(roundHashrateToWholeUnit(0), HASHES_PER_THS);
  assert.equal(ceilHashrateToWholeUnit(1.4e12), 2 * HASHES_PER_THS);
  assert.equal(floorHashrateToWholeUnit(1.9e12), HASHES_PER_THS);
  // At and above 1 PH/s, targets round to whole PH/s.
  assert.equal(roundHashrateToWholeUnit(1.4e15), 1e15);
  assert.equal(ceilHashrateToWholeUnit(1.1e15), 2e15);
  assert.equal(floorHashrateToWholeUnit(1.9e15), 1e15);
  assert.equal(ceilHashrateToWholeUnit(999.5e12), 1e15);
  assert.equal(floorHashrateToWholeUnit(1000.5e12), 1e15);
});
