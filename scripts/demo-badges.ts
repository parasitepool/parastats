#!/usr/bin/env node
/**
 * Seed the local SQLite `user_badges` cache with synthetic badge payloads across
 * every badge type so the badge UI can be previewed without a running para
 * server. Each demo address is registered as a public monitored user and its
 * cache entry is written fresh (fetched_at = now) so the badges API serves it
 * from cache instead of calling upstream.
 *
 * Run with:  just demo_badges     (or)   pnpm tsx scripts/demo-badges.ts
 * Clear with: pnpm tsx scripts/demo-badges.ts --clear
 */
import 'dotenv/config';
import { getDb } from '@/lib/db';
import {
  BLOCK_BADGE_ID,
  BLOCK_WINNER_BADGE_ID,
  LOYALTY_BADGE_ID,
  REFINERY_BADGE_ID,
  DISPENSER_BADGE_ID,
  type BadgesPayload,
  type BadgeType,
} from '@/lib/badge-types';

const BASE_HEIGHT = 800_000;

interface Spec {
  address: string;
  block: number;      // block participation count
  winners: number[];  // won block heights
  loyalty: number;    // loyalty instances
  refinery: number;   // fulfilled refinery orders
  dispenser: number;  // distinct dispenser asset types
  note: string;
}

// Valid mainnet addresses (mix of P2PKH / P2SH / bech32).
const DEMO_USERS: Spec[] = [
  { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', block: 0, winners: [], loyalty: 0, refinery: 0, dispenser: 0, note: 'empty state' },
  { address: '1CPDJtMzuSyvnGi8o9ZAtAWPfqHZhjQQhB',        block: 1, winners: [], loyalty: 0, refinery: 0, dispenser: 0, note: '1 block medal' },
  { address: '3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX',        block: 3, winners: [], loyalty: 0, refinery: 0, dispenser: 0, note: '3 block medals, no stack' },
  { address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',        block: 13, winners: [], loyalty: 0, refinery: 0, dispenser: 0, note: '3 medals + "10" stack' },
  { address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',        block: 6, winners: [812345], loyalty: 0, refinery: 0, dispenser: 0, note: '1 winner trophy + 3 medals + "3"' },
  { address: '12dRugNcdxK39288NjcDV4GX7rMsKCGn6B',        block: 0, winners: [], loyalty: 1, refinery: 0, dispenser: 0, note: 'loyalty x1 (no bubble)' },
  { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',        block: 0, winners: [], loyalty: 3, refinery: 0, dispenser: 0, note: 'loyalty x3 (30k blocks)' },
  { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', block: 0, winners: [], loyalty: 0, refinery: 1, dispenser: 0, note: 'refinery x1 (no bubble)' },
  { address: '3P14159f73E4gFr7JterCCQh9QjiTjiZrG',        block: 0, winners: [], loyalty: 0, refinery: 3, dispenser: 0, note: 'refinery x3' },
  { address: 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', block: 0, winners: [], loyalty: 0, refinery: 0, dispenser: 4, note: 'dispenser x4 asset types' },
  { address: '1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF',        block: 42, winners: [790111, 795222], loyalty: 3, refinery: 2, dispenser: 5, note: 'the full set' },
];

function buildBlock(total: number): BadgeType {
  const uniqueCount = Math.min(total, 3);
  const unique = Array.from({ length: uniqueCount }, (_, i) => ({ blockheight: BASE_HEIGHT + i * 1_000 }));
  return { kind: 'unique_then_bucket', unique, bucket: { count: Math.max(total - 3, 0) }, total };
}

function buildUnique(heights: number[]): BadgeType {
  return { kind: 'unique', unique: heights.map((blockheight) => ({ blockheight })), bucket: { count: 0 }, total: heights.length };
}

function buildBucket(count: number): BadgeType {
  return { kind: 'bucket', unique: [], bucket: { count }, total: count };
}

function buildPayload(spec: Spec): BadgesPayload {
  return {
    version: 1,
    computed_at: new Date().toISOString(),
    types: {
      [BLOCK_BADGE_ID]: buildBlock(spec.block),
      [BLOCK_WINNER_BADGE_ID]: buildUnique(spec.winners),
      [LOYALTY_BADGE_ID]: buildBucket(spec.loyalty),
      [REFINERY_BADGE_ID]: buildBucket(spec.refinery),
      [DISPENSER_BADGE_ID]: buildBucket(spec.dispenser),
    },
  };
}

function main() {
  const db = getDb();
  const clear = process.argv.includes('--clear');
  const now = Math.floor(Date.now() / 1000);

  const upsertUser = db.prepare(`
    INSERT INTO monitored_users (address, is_active, is_public, created_at, updated_at)
    VALUES (?, 1, 1, ?, ?)
    ON CONFLICT(address) DO UPDATE SET is_active = 1, is_public = 1, updated_at = excluded.updated_at
  `);

  const upsertBadges = db.prepare(`
    INSERT INTO user_badges (address, payload, fetched_at)
    VALUES (?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at
  `);

  const deleteBadges = db.prepare(`DELETE FROM user_badges WHERE address = ?`);

  db.transaction(() => {
    for (const spec of DEMO_USERS) {
      if (clear) {
        deleteBadges.run(spec.address);
        continue;
      }
      upsertUser.run(spec.address, now, now);
      upsertBadges.run(spec.address, JSON.stringify(buildPayload(spec)), now);
    }
  })();

  if (clear) {
    console.log(`🧹 Cleared ${DEMO_USERS.length} demo badge cache entries.`);
    return;
  }

  console.log(`🏅 Seeded ${DEMO_USERS.length} demo users. Start the app (\`just dev\`) and visit:\n`);
  for (const spec of DEMO_USERS) {
    console.log(`  /user/${spec.address}`);
    console.log(`      → ${spec.note}`);
  }
  console.log(`\nUndo with: just demo_badges_clear`);
}

main();
