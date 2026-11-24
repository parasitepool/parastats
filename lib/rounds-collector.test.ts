import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

process.env.PARASTATS_DATA_DIR = mkdtempSync(join(tmpdir(), 'rounds-collector-'));

interface ParticipantRow {
  username: string;
  top_diff: number;
  blocks_participated: number;
  total_work: number;
}

test('mergeBlockDiffsIntoCurrentRound merges post-round block diffs without overwriting higher diffs or counts', async t => {
  const { getDb, closeDb } = await import('./db');
  const { mergeBlockDiffsIntoCurrentRound } = await import('./rounds-collector');

  const db = getDb();

  t.after(() => {
    const dataDir = process.env.PARASTATS_DATA_DIR!;
    closeDb();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const insertBlock = db.prepare(
    'INSERT INTO block_highest_diff (block_height, winner_address, difficulty, block_timestamp) VALUES (?, ?, ?, ?)',
  );
  const insertUserDiff = db.prepare(
    'INSERT INTO user_block_diff (block_height, address, difficulty) VALUES (?, ?, ?)',
  );
  const insertParticipant = db.prepare(
    'INSERT INTO round_participants (block_height, username, top_diff, blocks_participated, total_work) VALUES (0, ?, ?, ?, ?)',
  );
  const getParticipants = () => db.prepare(
    'SELECT username, top_diff, blocks_participated, total_work FROM round_participants WHERE block_height = 0 ORDER BY username ASC',
  ).all() as ParticipantRow[];

  insertBlock.run(100, 'foo', 500, 1);
  insertUserDiff.run(100, 'foo', 500);
  insertBlock.run(101, 'foo', 800, 2);
  insertUserDiff.run(101, 'foo', 800);
  insertUserDiff.run(101, 'bar', 200);
  insertUserDiff.run(101, 'baz', 300);
  insertUserDiff.run(101, 'qux', 0);
  insertBlock.run(102, 'baz', 400, 3);
  insertUserDiff.run(102, 'baz', 400);
  insertUserDiff.run(102, 'qux', -5);

  mergeBlockDiffsIntoCurrentRound(db);
  assert.deepEqual(getParticipants(), []);

  db.prepare(
    'INSERT INTO rounds (block_height, block_hash, created_at) VALUES (?, ?, ?)',
  ).run(100, 'hash', 1);

  insertParticipant.run('foo', 100, 10, 1234);
  insertParticipant.run('bar', 900, 20, 5678);

  mergeBlockDiffsIntoCurrentRound(db, 100);
  assert.deepEqual(getParticipants(), [
    { username: 'bar', top_diff: 900, blocks_participated: 20, total_work: 5678 },
    { username: 'foo', top_diff: 100, blocks_participated: 10, total_work: 1234 },
  ]);

  mergeBlockDiffsIntoCurrentRound(db, 101);
  assert.deepEqual(getParticipants(), [
    { username: 'bar', top_diff: 900, blocks_participated: 20, total_work: 5678 },
    { username: 'baz', top_diff: 300, blocks_participated: 1, total_work: 0 },
    { username: 'foo', top_diff: 800, blocks_participated: 10, total_work: 1234 },
  ]);

  db.prepare('DELETE FROM round_participants WHERE block_height = 0').run();
  insertParticipant.run('foo', 100, 10, 1234);
  insertParticipant.run('bar', 900, 20, 5678);

  mergeBlockDiffsIntoCurrentRound(db);
  assert.deepEqual(getParticipants(), [
    { username: 'bar', top_diff: 900, blocks_participated: 20, total_work: 5678 },
    { username: 'baz', top_diff: 400, blocks_participated: 2, total_work: 0 },
    { username: 'foo', top_diff: 800, blocks_participated: 10, total_work: 1234 },
  ]);
});
