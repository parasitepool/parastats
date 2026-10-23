import cron from 'node-cron';
import { getDb, ROUTER_CAPACITY_RETENTION_SECONDS } from './db';
import { fetch } from './http-client';

// Samples the refinery router's used capacity every minute so the Demand
// chart can plot it as a time series. Rows older than 24 hours are purged.
let isRunning = false;

async function collectRouterCapacity() {
  if (isRunning) return;
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) return;

  isRunning = true;
  try {
    const headers: Record<string, string> = {};
    if (process.env.ROUTER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.ROUTER_API_TOKEN}`;
    }

    const res = await fetch(`${routerBase}/api/router/status`, { cache: 'no-store', headers });
    if (!res.ok) throw new Error(`Router status failed (${res.status})`);

    const status = await res.json();
    if (typeof status.used_capacity_hash_days !== 'number') return;

    getDb()
      .prepare('INSERT OR REPLACE INTO router_capacity (timestamp, used_hash_days) VALUES (?, ?)')
      .run(Math.floor(Date.now() / 1000), status.used_capacity_hash_days);
    console.log(`Router capacity collected and stored at ${new Date().toISOString()}`);
  } catch (error) {
    console.warn('Router capacity collection failed:', error);
  } finally {
    isRunning = false;
  }
}

export function startRouterCapacityCollector() {
  if (!process.env.ROUTER_API_URL) {
    console.log('Router capacity collector disabled (no ROUTER_API_URL)');
    return null;
  }

  const job = cron.schedule('* * * * *', async () => {
    await collectRouterCapacity();
  });
  console.log('Router capacity collector started');

  // Run an initial collection immediately
  collectRouterCapacity();

  return job;
}

export function purgeOldRouterCapacity() {
  const cutoff = Math.floor(Date.now() / 1000) - ROUTER_CAPACITY_RETENTION_SECONDS;
  return getDb().prepare('DELETE FROM router_capacity WHERE timestamp < ?').run(cutoff).changes;
}
