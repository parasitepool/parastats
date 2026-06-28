import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/formatters';
import { fetch } from '@/lib/http-client';
import { fetchWithCache } from '@/lib/aggregator-cache';
import { getDb } from '@/lib/db';

interface AggregatorPoolData {
  statsData: Record<string, number>;
  hashrateData: Record<string, string>;
  diffData: Record<string, number>;
}

export async function GET() {
  try {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Error fetching pool stats: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch pool stats" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const { data: poolData } = await fetchWithCache<AggregatorPoolData>(
      `${apiUrl}/aggregator/pool/pool.status`,
      async () => {
        const response = await fetch(`${apiUrl}/aggregator/pool/pool.status`, {
          headers,
        });
        const text = await response.text();
        const jsonLines = text.trim().split('\n').map(line => JSON.parse(line));
        const [statsData, hashrateData, diffData] = jsonLines;
        return { statsData, hashrateData, diffData };
      },
    );

    const { statsData, hashrateData, diffData } = poolData;

    const startTime = new Date('2025-04-20T16:20:00-04:00');
    const currentTime = new Date();
    const uptimeSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);

    let lastBlockTime: string | null = null;
    let lastBlockHash: string | null = null;
    let totalWorkSinceLastBlock: number | undefined;
    try {
      const blocksRes = await fetch('https://mempool.space/api/v1/mining/pool/parasite/blocks');
      if (blocksRes.ok) {
        const blocks = await blocksRes.json();
        if (blocks.length > 0) {
          lastBlockTime = String(blocks[0].height);
          lastBlockHash = blocks[0].id;

          if (blocks[0].timestamp) {
            const blockTimestamp = blocks[0].timestamp;
            const now = Math.floor(Date.now() / 1000);
            const db = getDb();

            const checkpoint = db.prepare(
              'SELECT checkpoint_timestamp, cumulative_work FROM total_work_checkpoints WHERE block_hash = ?'
            ).get(lastBlockHash) as { checkpoint_timestamp: number; cumulative_work: number } | undefined;

            const fromTimestamp = checkpoint ? checkpoint.checkpoint_timestamp : blockTimestamp;

            // Sum pool_stats rows from the last checkpoint (or block start) to now.
            // Uses actual row gaps so collection outages don't inflate the total.
            const rows = db.prepare(`
              SELECT hashrate15m, timestamp
              FROM pool_stats
              WHERE timestamp > ? AND timestamp <= ?
              ORDER BY timestamp ASC
            `).all(fromTimestamp, now) as Array<{ hashrate15m: string; timestamp: number }>;

            let liveHashes = 0;
            let prevTime = fromTimestamp;
            for (const row of rows) {
              liveHashes += parseHashrate(row.hashrate15m) * (row.timestamp - prevTime);
              prevTime = row.timestamp;
            }

            if (rows.length > 0 || checkpoint) {
              totalWorkSinceLastBlock = (checkpoint?.cumulative_work ?? 0) + liveHashes / Math.pow(2, 32);
            } else {
              // No DB rows yet (collector not running) — fall back to 1D avg estimate
              totalWorkSinceLastBlock = (parseHashrate(hashrateData.hashrate1d) * (now - blockTimestamp)) / Math.pow(2, 32);
            }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching last block from mempool.space:", e);
    }

    const poolStats: PoolStats = {
      uptime: formatUptime(uptimeSeconds),
      lastBlockTime,
      lastBlockHash,
      highestDifficulty: formatDifficulty(diffData.bestshare),
      hashrate: parseHashrate(hashrateData.hashrate5m),
      users: statsData.Users,
      workers: statsData.Workers,
      totalWorkSinceLastBlock,
    };
    
    return NextResponse.json(poolStats);
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    return NextResponse.json({ error: "Failed to fetch pool stats" }, { status: 500 });
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  return `${days}d ${hours}h`;
}
