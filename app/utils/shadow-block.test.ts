import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRandomDelays,
  isShadowBlockTopDiffShare,
  parseBlockParam,
  shadowBlockTopDiffSignature,
  type ShadowBlockTopDiff,
} from './shadow-block';

const topDiff: ShadowBlockTopDiff = {
  block_height: 975_709,
  block_timestamp: 1_794_589_633,
  top_diff_address: 'bc1q...z263',
  difficulty: 112_141_230_886,
};

test('top diff share filtering', () => {
  assert.equal(isShadowBlockTopDiffShare(topDiff), true);
  assert.equal(isShadowBlockTopDiffShare({ ...topDiff, top_diff_address: null }), false);
  assert.equal(isShadowBlockTopDiffShare({ ...topDiff, difficulty: null }), false);
});

test('top diff signatures change with stream content', () => {
  const other: ShadowBlockTopDiff = { ...topDiff, block_height: 975_710 };

  assert.equal(
    shadowBlockTopDiffSignature([topDiff]),
    shadowBlockTopDiffSignature([{ ...topDiff }]),
  );
  assert.notEqual(
    shadowBlockTopDiffSignature([topDiff]),
    shadowBlockTopDiffSignature([other]),
  );
  assert.notEqual(
    shadowBlockTopDiffSignature([topDiff]),
    shadowBlockTopDiffSignature([{ ...topDiff, top_diff_address: 'bc1q...abcd' }]),
  );
  assert.notEqual(
    shadowBlockTopDiffSignature([topDiff]),
    shadowBlockTopDiffSignature([{ ...topDiff, difficulty: 1 }]),
  );
});

test('block query parsing', () => {
  assert.equal(parseBlockParam('975709'), 975709);
  assert.equal(parseBlockParam(['975709', '975710']), 975709);
  assert.equal(parseBlockParam(undefined), null);
  assert.equal(parseBlockParam(''), null);
  assert.equal(parseBlockParam('123abc'), null);
  assert.equal(parseBlockParam('-1'), null);
});

test('random delays stay within the loop', () => {
  const count = 20;
  const duration = 60_000;
  const delays = buildRandomDelays(count, duration, 5_000);

  assert.equal(delays.length, count);
  assert.ok(delays.every(Number.isFinite));
  assert.ok(delays[0] > 0);

  for (let i = 1; i < delays.length; i += 1) {
    assert.ok(delays[i] > delays[i - 1]);
  }
  assert.ok(delays[delays.length - 1] <= duration);
});

test('random delays handle tiny loops', () => {
  const delays = buildRandomDelays(3, 1_000, 5_000);

  assert.equal(delays.length, 3);
  assert.ok(delays.every((delay) => delay > 0 && delay <= 1_000));
  assert.ok(delays[0] < delays[1] && delays[1] < delays[2]);
});

test('random delays handle invalid inputs', () => {
  assert.deepEqual(buildRandomDelays(0, 60_000, 5_000), []);
  assert.deepEqual(buildRandomDelays(10, 0, 5_000), []);
});
