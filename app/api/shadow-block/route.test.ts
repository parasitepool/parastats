import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { formatAddress } from '@/app/utils/formatters';
import { SHADOW_BLOCK_MAX_BLOCKS } from '@/app/utils/shadow-block';

// The db module fixes its data directory when it first loads, so point it at
// a scratch dir before importing the route (which imports the db module).
process.env.PARASTATS_DATA_DIR = mkdtempSync(join(tmpdir(), 'shadow-block-route-'));

const PUBLIC_ADDRESS = 'bc1qpublicexampleaddress0000000000000000001aaaa';
const PRIVATE_ADDRESS = 'bc1qprivateexampleaddress000000000000000002bbbb';

interface Row {
  block_height: number;
  block_timestamp: number | null;
  top_diff_address: string | null;
  difficulty: number | null;
}

test('shadow-block top diffs clamp the limit, filter private users, and truncate addresses', async t => {
  const { GET } = await import('./route');
  const { getDb, closeDb } = await import('@/lib/db');

  const db = getDb();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const insertBlock = db.prepare(
    'INSERT INTO block_highest_diff (block_height, winner_address, difficulty, block_timestamp) VALUES (?, ?, ?, ?)',
  );
  const insertUserDiff = db.prepare(
    'INSERT INTO user_block_diff (block_height, address, difficulty) VALUES (?, ?, ?)',
  );
  const insertMonitored = db.prepare(
    'INSERT INTO monitored_users (address, is_active, is_public, created_at, updated_at) VALUES (?, 1, ?, 0, 0)',
  );

  // 300 recent blocks to exercise limit clamping (max is 288).
  for (let offset = 0; offset < 300; offset++) {
    insertBlock.run(800_000 + offset, 'bc1qblockwinnervalue0000000000000000000', 1e9, nowSeconds - 60);
    insertUserDiff.run(800_000 + offset, PUBLIC_ADDRESS, 1e9);
  }

  // A private user with the highest diff must be filtered out, leaving the
  // public runner-up as the top diff.
  insertBlock.run(900_001, 'bc1qblockwinnervalue0000000000000000000', 1e9, nowSeconds - 60);
  insertUserDiff.run(900_001, PUBLIC_ADDRESS, 5e12);
  insertUserDiff.run(900_001, PRIVATE_ADDRESS, 9e12);
  insertMonitored.run(PRIVATE_ADDRESS, 0);

  // A block whose only participant is private exposes no top diff.
  insertBlock.run(900_002, 'bc1qblockwinnervalue0000000000000000000', 1e9, nowSeconds - 90);
  insertUserDiff.run(900_002, PRIVATE_ADDRESS, 3e12);

  // Blocks without a timestamp or outside the 24h window are excluded.
  insertBlock.run(900_003, 'bc1qblockwinnervalue0000000000000000000', 1e9, null);
  insertUserDiff.run(900_003, PUBLIC_ADDRESS, 7e12);
  insertBlock.run(900_004, 'bc1qblockwinnervalue0000000000000000000', 1e9, nowSeconds - 25 * 3600);
  insertUserDiff.run(900_004, PUBLIC_ADDRESS, 8e12);

  t.after(() => {
    const dataDir = process.env.PARASTATS_DATA_DIR!;
    closeDb();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const request = (query = '') => GET(new NextRequest(`http://parastats.test/api/shadow-block${query}`));
  const readRows = async (response: Response) => {
    assert.equal(response.status, 200);
    return await response.json() as Row[];
  };

  // No/invalid/huge limits all clamp to the cap, newest first.
  const capped = await readRows(await request());
  assert.equal(capped.length, SHADOW_BLOCK_MAX_BLOCKS);
  assert.equal(capped[0].block_height, 900_002);
  assert.equal((await readRows(await request('?limit=999'))).length, SHADOW_BLOCK_MAX_BLOCKS);
  assert.equal((await readRows(await request('?limit=abc'))).length, SHADOW_BLOCK_MAX_BLOCKS);

  // Small limits return the newest blocks; 0 clamps up to 1.
  const topTwo = await readRows(await request('?limit=2'));
  assert.deepEqual(topTwo.map(row => row.block_height), [900_002, 900_001]);
  assert.equal((await readRows(await request('?limit=0'))).length, 1);

  // The private-only block exposes no top diff.
  assert.equal(topTwo[0].top_diff_address, null);
  assert.equal(topTwo[0].difficulty, null);

  // The private user is filtered out; the public runner-up is the top diff,
  // with a truncated address only.
  assert.equal(topTwo[1].top_diff_address, formatAddress(PUBLIC_ADDRESS));
  assert.equal(topTwo[1].difficulty, 5e12);

  // The full private address must never leak, and blocks outside the
  // timestamp window never appear.
  const allRows = await readRows(await request('?limit=288'));
  const serialized = JSON.stringify(allRows);
  assert.ok(!serialized.includes(PRIVATE_ADDRESS));
  assert.ok(!serialized.includes('bc1qprivateexampleaddress'));
  assert.ok(!allRows.some(row => row.block_height === 900_003 || row.block_height === 900_004));

  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT u.address, u.difficulty
    FROM user_block_diff u
    LEFT JOIN monitored_users m ON m.address = u.address
    WHERE u.block_height = ? AND (m.is_public = 1 OR m.address IS NULL)
    ORDER BY u.difficulty DESC
    LIMIT 1
  `).all(900_001) as { detail: string }[];
  const planText = plan.map(row => row.detail).join('\n');
  assert.ok(planText.includes('idx_user_block_diff_height_diff'), planText);
  assert.ok(!planText.includes('TEMP B-TREE'), planText);
});
