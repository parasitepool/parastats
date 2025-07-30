import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/formatters';

export async function GET() {
  try {
    const response = await fetch("https://fkb.parasite.xyz/aggregator/pool/pool.status", {
      next: { revalidate: 10 } // Cache for 10 seconds
    });
    const text = await response.text();
    
    // Split the response into lines and parse each JSON object
    const jsonLines = text.trim().split('\n').map(line => JSON.parse(line));
    
    // Combine the data from all three objects
    const [statsData, hashrateData, diffData] = jsonLines;

    const poolStats: PoolStats = {
      uptime: formatUptime(statsData.runtime),
      lastBlockTime: "N/A", // Not sure if this will be available
      highestDifficulty: formatDifficulty(diffData.bestshare),
      hashrate: parseHashrate(hashrateData.hashrate15m),
      users: statsData.Users,
      workers: statsData.Workers
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
