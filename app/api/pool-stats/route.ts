import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/formatters';
import { fetch, HttpError } from '@/lib/http-client';
import { fetchWithCache } from '@/lib/aggregator-cache';
import { getDb } from '@/lib/db';

interface AggregatorPoolData {
  statsData: Record<string, number>;
  hashrateData: Record<string, string>;
  diffData: Record<string, number>;
}

// Counted work (sum of accepted share difficulty) for the current round, from
// the locally-cached per-participant totals.
function getWorkSinceLastBlock(): number | null {
  try {
    const row = getDb()
      .prepare('SELECT SUM(total_work) AS work FROM round_participants WHERE block_height = 0')
      .get() as { work: number | null } | undefined;
    return row?.work ?? null;
  } catch (error) {
    console.error('Error computing work since last block:', error);
    return null;
  }
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

    const url = `${apiUrl}/aggregator/pool/pool.status`;
    const { data: poolData } = await fetchWithCache<AggregatorPoolData>(
      url,
      async () => {
        const response = await fetch(url, {
          headers,
        });
        if (!response.ok) {
          throw new HttpError(response.status, response.statusText, url);
        }
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
    try {
      const blocksRes = await fetch('https://mempool.space/api/v1/mining/pool/parasite/blocks');
      if (blocksRes.ok) {
        const blocks = await blocksRes.json();
        if (blocks.length > 0) {
          lastBlockTime = String(blocks[0].height);
          lastBlockHash = blocks[0].id;
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
      workSinceLastBlock: getWorkSinceLastBlock(),
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
