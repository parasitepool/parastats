#!/usr/bin/env node
import { getDb, closeDb } from '../lib/db';

const db = getDb();

const rows = db.prepare(`SELECT address FROM monitored_users WHERE is_public = 0`).all() as { address: string }[];

closeDb();

if (rows.length === 0) {
  console.log('-- No users with is_public = 0 found. Nothing to migrate.');
  process.exit(0);
}

const addresses = rows.map(r => r.address);
const addressList = addresses.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');

console.log(`-- Privacy migration for ${addresses.length} user(s) with is_public = 0`);
console.log(`-- Generated at ${new Date().toISOString()}`);
console.log();
console.log(`INSERT INTO account_metadata (account_id, data, created_at, updated_at)`);
console.log(`SELECT a.id, '{"is_private": true}'::jsonb, NOW(), NOW()`);
console.log(`FROM accounts a`);
console.log(`WHERE a.username IN (${addressList})`);
console.log(`ON CONFLICT (account_id) DO UPDATE`);
console.log(`SET data = account_metadata.data || '{"is_private": true}'::jsonb,`);
console.log(`    updated_at = NOW();`);
