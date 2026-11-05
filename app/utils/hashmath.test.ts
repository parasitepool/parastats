import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HASH_DAYS_PER_PHD,
  HASHES_PER_DIFF_1,
  SECONDS_PER_DAY,
  formatDifficulty,
  formatHashDays,
  formatHashWork,
  formatHashrate,
  formatPercent,
  hashDaysFromPhd,
  hashDaysToHashWork,
  hashWorkFromRate,
  hashWorkToHashDays,
  orderTotal,
  parseHashrate,
  phdFromHashDays,
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
