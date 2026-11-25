import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/hashmath';
import { fetch, HttpError } from '@/lib/http-client';
import { fetchWithCache } from '@/lib/aggregator-cache';
import { cachedJson } from '@/lib/route-cache';
import { getDb } from '@/lib/db';

const POOL_STATS_CACHE_TTL_MS = 10_000;
const LAST_BLOCK_FALLBACK_TTL_MS = 5 * 60_000;

interface AggregatorPoolData {
  statsData: Record<string, number>;
  hashrateData: Record<string, string>;
  diffData: Record<string, number>;
}

interface LastBlockInfo {
  lastBlockTime: string | null;
  lastBlockHash: string | null;
}

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

function getLastBlockFromDb(): LastBlockInfo | null {
  try {
    const row = getDb()
      .prepare('SELECT block_height, block_hash FROM rounds WHERE block_height > 0 ORDER BY block_height DESC LIMIT 1')
      .get() as { block_height: number; block_hash: string } | undefined;
    if (!row) return null;
    return {
      lastBlockTime: String(row.block_height),
      lastBlockHash: row.block_hash,
    };
  } catch (error) {
    console.error('Error reading last block from rounds:', error);
    return null;
  }
}

async function getLastBlockInfo(): Promise<LastBlockInfo> {
  const localBlock = getLastBlockFromDb();
  if (localBlock) return localBlock;

  return cachedJson<LastBlockInfo>(
    'pool-stats:last-block-fallback',
    LAST_BLOCK_FALLBACK_TTL_MS,
    async () => {
      try {
        const blocksRes = await fetch('https://mempool.space/api/v1/mining/pool/parasite/blocks', {
          timeout: 5_000,
        });
        if (blocksRes.ok) {
          const blocks = await blocksRes.json();
          if (blocks.length > 0) {
            return {
              lastBlockTime: String(blocks[0].height),
              lastBlockHash: blocks[0].id,
            };
          }
        }
      } catch (e) {
        console.error("Error fetching last block from mempool.space:", e);
      }
      return { lastBlockTime: null, lastBlockHash: null };
    },
    info => info.lastBlockTime !== null,
  );
}

export async function GET() {
  try {
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Error fetching pool stats: No API_URL defined in env");
      return NextResponse.json(
        { error: "Failed to fetch pool stats" },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const poolStats = await cachedJson<PoolStats>(
      'pool-stats',
      POOL_STATS_CACHE_TTL_MS,
      async () => {
        const url = `${apiUrl}/aggregator/pool/pool.status`;
        const [{ data: poolData }, lastBlock] = await Promise.all([
          fetchWithCache<AggregatorPoolData>(
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
          ),
          getLastBlockInfo(),
        ]);

        const { statsData, hashrateData, diffData } = poolData;

        const startTime = new Date('2025-04-20T16:20:00-04:00');
        const currentTime = new Date();
        const uptimeSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);

        return {
          uptime: formatUptime(uptimeSeconds),
          lastBlockTime: lastBlock.lastBlockTime,
          lastBlockHash: lastBlock.lastBlockHash,
          highestDifficulty: formatDifficulty(diffData.bestshare),
          hashrate: parseHashrate(hashrateData.hashrate5m),
          users: statsData.Users,
          workers: statsData.Workers,
          workSinceLastBlock: getWorkSinceLastBlock(),
        };
      },
    );

    return NextResponse.json(poolStats, {
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=20',
      },
    });
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool stats" },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  return `${days}d ${hours}h`;
}
