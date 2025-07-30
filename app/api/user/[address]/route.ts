import { NextResponse } from 'next/server';
import { formatDifficulty, parseHashrate } from '../../../utils/formatters';
import { formatRelativeTime } from '../../../utils/formatters';

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
    
    // Fetch user data from parasite.wtf
    const response = await fetch(`https://parasite.wtf/aggregator/users/${address}`, {
      next: { revalidate: 10 } // Cache for 10 seconds
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const userData: UserData = await response.json();
    
    // Process the user data
    const processedData: ProcessedUserData = {
      hashrate: parseHashrate(userData.hashrate5m),
      workers: userData.workers,
      lastSubmission: formatRelativeTime(userData.lastshare),
      bestDifficulty: formatDifficulty(userData.bestever),
      uptime: calculateUptime(userData.authorised),
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
