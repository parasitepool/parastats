import { NextResponse } from 'next/server';
import { formatDifficulty, parseHashrate } from '@/app/utils/formatters';
import { formatRelativeTime } from '@/app/utils/formatters';
import { fetch } from '@/lib/http-client';

export interface WorkerData {
  workername: string;
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  shares: number;
  bestshare: number;
  bestever: number;
}

export interface UserData {
  hashrate1m: string;
  hashrate5m: string;
  hashrate1hr: string;
  hashrate1d: string;
  hashrate7d: string;
  lastshare: number;
  workers: number;
  shares: number;
  bestshare: number;
  bestever: number;
  authorised: number;
  worker: WorkerData[];
}

export interface ProcessedUserData {
  hashrate: number;
  workers: number;
  lastSubmission: string;
  bestDifficulty: string;
  uptime: string;
  isPublic: boolean;
  workerData: ProcessedWorkerData[];
}

export interface ProcessedWorkerData {
  id: string;
  name: string;
  hashrate: string;
  bestDifficulty: string;
  lastSubmission: string;
  uptime: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to fetch user data: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/aggregator/users/${address}`, {
      headers,
      next: { revalidate: 10 } // Cache for 10 seconds
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const userData: UserData = await response.json();

    // Fetch isPublic from database
    // We don't store live data in db, but we do store user preferences like is_public
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const dbUser = db.prepare('SELECT is_public FROM monitored_users WHERE address = ?').get(address) as { is_public: number } | undefined;

    // Process the user data
    const processedData: ProcessedUserData = {
      hashrate: parseHashrate(userData.hashrate5m),
      workers: userData.workers,
      lastSubmission: formatRelativeTime(userData.lastshare),
      bestDifficulty: formatDifficulty(userData.bestever),
      uptime: calculateUptime(userData.authorised),
      isPublic: dbUser ? Boolean(dbUser.is_public) : true, // Default to public if not in DB
      workerData: processWorkerData(userData.worker),
    };

    return NextResponse.json(processedData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

function processWorkerData(workers: WorkerData[]): ProcessedWorkerData[] {
  return workers.map(worker => {
    const nameParts = worker.workername.split('.');
    const name = nameParts.length > 1 ? nameParts[1] : 'default';
    
    return {
      id: worker.workername,
      name: name,
      hashrate: parseHashrate(worker.hashrate5m).toString(),
      bestDifficulty: worker.bestever.toString(),
      lastSubmission: worker.lastshare.toString(),
      uptime: 'N/A', // We don't have direct uptime information for workers
    };
  });
}

function calculateUptime(authorisedTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
  const uptimeSeconds = now - authorisedTimestamp;

  const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
  const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));

  return `${days}d ${hours}h`;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const { getDb } = await import('@/lib/db');
    const db = getDb();

    // Get current is_public value
    const user = db.prepare('SELECT is_public FROM monitored_users WHERE address = ?').get(address) as { is_public: number } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Toggle the is_public value
    const newValue = user.is_public ? 0 : 1;
    db.prepare('UPDATE monitored_users SET is_public = ?, updated_at = ? WHERE address = ?')
      .run(newValue, Math.floor(Date.now() / 1000), address);

    return NextResponse.json({ isPublic: Boolean(newValue) });
  } catch (error) {
    console.error('Error toggling user visibility:', error);
    return NextResponse.json(
      { error: 'Failed to toggle visibility' },
      { status: 500 }
    );
  }
} 
