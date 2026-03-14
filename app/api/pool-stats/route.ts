import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/formatters';
import { fetch } from '@/lib/http-client';

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
    const response = await fetch(`${apiUrl}/aggregator/pool/pool.status`, {
      headers,
    });
    const text = await response.text();
    
    // Split the response into lines and parse each JSON object
    const jsonLines = text.trim().split('\n').map(line => JSON.parse(line));
    
    // Combine the data from all three objects
    const [statsData, hashrateData, diffData] = jsonLines;

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
      workers: statsData.Workers
    };
    
    return NextResponse.json(poolStats, {
      headers: {
        'Cache-Control': 's-maxage=10, stale-while-revalidate=20',
      },
    });
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
