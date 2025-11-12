import { NextResponse } from 'next/server';
import { type PoolStats } from '../../utils/api';
import { formatDifficulty, parseHashrate } from '../../utils/formatters';
import { fetch } from '@/lib/http-client';

// Simple in-memory cache for fallback data
let cachedPoolStats: PoolStats | null = null;
let lastSuccessfulFetch: number = 0;
const CACHE_TTL = 60000; // 1 minute

// Circuit breaker state
let consecutiveFailures = 0;
let circuitBreakerTrippedUntil = 0;
const MAX_FAILURES = 5; // Trip circuit after 5 consecutive failures
const CIRCUIT_RESET_TIME = 30000; // 30 seconds

// Retryable HTTP status codes (transient errors)
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// Cache for discovered endpoint path
let discoveredEndpoint: string | null = null;

/**
 * Discover the correct pool stats endpoint by trying common paths
 */
async function discoverPoolStatsEndpoint(apiUrl: string, headers: Record<string, string>): Promise<string> {
  const possiblePaths = [
    '/pool/pool.status',           // If API_URL already includes /aggregator
    '/aggregator/pool/pool.status', // If API_URL is just the base domain
    '/api/pool/pool.status',
    '/pool.status',
    '/pool/status',
  ];

  for (const path of possiblePaths) {
    try {
      const testUrl = `${apiUrl}${path}`;
      const response = await fetch(testUrl, { 
        headers,
        timeout: 5000 
      });
      if (response.ok) {
        console.log(`✓ Discovered pool stats endpoint: ${path}`);
        return path;
      }
    } catch {
      // Continue trying other paths
    }
  }

  // Default to the most common path if discovery fails
  return '/aggregator/pool/pool.status';
}

export async function GET() {
  // Check circuit breaker
  const now = Date.now();
  if (now < circuitBreakerTrippedUntil) {
    console.warn(`Circuit breaker is open. Serving cached data. Resets in ${Math.ceil((circuitBreakerTrippedUntil - now) / 1000)}s`);
    if (cachedPoolStats) {
      return NextResponse.json(cachedPoolStats, {
        headers: { 'X-Cache-Status': 'circuit-breaker' }
      });
    }
  }

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

    // Discover endpoint on first run or use cached/configured path
    if (!discoveredEndpoint) {
      const configuredPath = process.env.POOL_STATS_ENDPOINT;
      if (configuredPath) {
        discoveredEndpoint = configuredPath;
        console.log(`Using configured pool stats endpoint: ${configuredPath}`);
      } else {
        discoveredEndpoint = await discoverPoolStatsEndpoint(apiUrl, headers);
      }
    }

    const fullUrl = `${apiUrl}${discoveredEndpoint}`;
    
    // Try with retry logic for transient errors
    const maxRetries = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${maxRetries} for ${fullUrl}`);
          // Exponential backoff: 100ms, 200ms
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
        
        const response = await fetch(fullUrl, {
          headers,
          next: { revalidate: 10 } // Cache for 10 seconds
        });
        
        // Log the actual URL and status for debugging
        console.log(`Fetched ${fullUrl} - Status: ${response.status}`);
        
        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          
          // On 404, clear cached endpoint to rediscover next time
          if (response.status === 404) {
            discoveredEndpoint = null;
          }
          
          // Only retry on transient errors
          if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries) {
            console.warn(`${errorMsg} - will retry`);
            lastError = new Error(errorMsg);
            continue; // Retry
          }
          
          // For 404 or other non-retryable errors, throw immediately
          throw new Error(errorMsg);
        }
        
        const text = await response.text();
        
        // Defensive parsing: filter empty lines and parse with error handling
        const lines = text.trim().split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          throw new Error('Empty response from API');
        }
        
        const jsonLines = lines.map((line, index) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            console.error(`Failed to parse JSON line ${index + 1}:`, line.substring(0, 200));
            throw new Error(
              `Invalid JSON at line ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        });
        
        // Validate we got the expected number of objects
        if (jsonLines.length !== 3) {
          console.error(`Expected 3 JSON objects but got ${jsonLines.length}`);
          console.error('Response text:', text.substring(0, 500));
          throw new Error(
            `Incomplete response: expected 3 JSON objects but got ${jsonLines.length}. Response may be truncated.`
          );
        }
        
        // Combine the data from all three objects
        const [statsData, hashrateData, diffData] = jsonLines;

        // Validate required fields exist
        if (!statsData?.Users || !statsData?.Workers) {
          throw new Error('Missing required stats data fields');
        }
        if (!hashrateData?.hashrate15m) {
          throw new Error('Missing hashrate data');
        }
        if (!diffData?.bestshare) {
          throw new Error('Missing difficulty data');
        }

        const startTime = new Date('2025-04-20T16:20:00-04:00');
        const currentTime = new Date();
        const uptimeSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);

        const poolStats: PoolStats = {
          uptime: formatUptime(uptimeSeconds),
          lastBlockTime: "N/A",
          highestDifficulty: formatDifficulty(diffData.bestshare),
          hashrate: parseHashrate(hashrateData.hashrate15m),
          users: statsData.Users,
          workers: statsData.Workers
        };
        
        // Success! Update cache and reset failure counters
        cachedPoolStats = poolStats;
        lastSuccessfulFetch = Date.now();
        consecutiveFailures = 0;
        circuitBreakerTrippedUntil = 0;
        
        return NextResponse.json(poolStats, {
          headers: { 'X-Cache-Status': 'fresh' }
        });
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on non-retryable errors
        if (!lastError.message.match(/HTTP (408|429|500|502|503|504)/)) {
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Unknown error');
    
  } catch (error) {
    consecutiveFailures++;
    
    console.error("Error fetching pool stats:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error details:", errorMessage);
    
    // Trip circuit breaker if too many consecutive failures
    if (consecutiveFailures >= MAX_FAILURES) {
      circuitBreakerTrippedUntil = Date.now() + CIRCUIT_RESET_TIME;
      console.error(`Circuit breaker tripped after ${consecutiveFailures} consecutive failures. Will retry in ${CIRCUIT_RESET_TIME / 1000}s`);
    }
    
    // Try to serve cached data if available and not too old
    if (cachedPoolStats && (Date.now() - lastSuccessfulFetch) < CACHE_TTL * 10) {
      console.log('Serving stale cached data due to API error');
      return NextResponse.json(cachedPoolStats, {
        headers: { 
          'X-Cache-Status': 'stale',
          'X-Cache-Age': String(Math.floor((Date.now() - lastSuccessfulFetch) / 1000))
        }
      });
    }
    
    return NextResponse.json({ error: "Failed to fetch pool stats" }, { status: 500 });
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  return `${days}d ${hours}h`;
}
