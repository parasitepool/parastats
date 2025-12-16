'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDifficulty, formatAddress } from '@/app/utils/formatters';
import * as echarts from 'echarts';

interface BlockData {
  block_height: number;
  block_timestamp: number | null;
  winner: {
    address: string;
    fullAddress: string;
    difficulty: number;
  };
  users: {
    address: string;
    fullAddress: string;
    difficulty: number;
  }[];
  user_count: number;
}

interface BlockRange {
  min: number;
  max: number;
}

export default function BlockLeaderboard() {
  const params = useParams();
  const router = useRouter();
  const heightParam = params.height as string;
  const blockHeight = parseInt(heightParam, 10);

  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [blockRange, setBlockRange] = useState<BlockRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Fetch available block range
  useEffect(() => {
    const fetchBlockRange = async () => {
      try {
        const response = await fetch('/api/highest-diff?limit=1');
        if (!response.ok) return;
        const data = await response.json();
        if (data.length > 0) {
          const latestBlock = data[0].block_height;
          setBlockRange({
            min: Math.max(1, latestBlock - 499), // 500 blocks back
            max: latestBlock,
          });
        }
      } catch {
        console.error('Failed to fetch block range');
      }
    };

    fetchBlockRange();
  }, []);

  // Fetch block data
  useEffect(() => {
    if (isNaN(blockHeight) || blockHeight < 0) {
      setError('Invalid block height');
      setLoading(false);
      return;
    }

    const fetchBlockData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/highest-diff/${blockHeight}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('No difficulty data found for this block');
          } else {
            setError('Failed to fetch block data');
          }
          setBlockData(null);
          return;
        }
        const data = await response.json();
        setBlockData(data);
      } catch {
        setError('Failed to fetch block data');
        setBlockData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockData();
  }, [blockHeight]);

  // Keyboard navigation - left goes to newer (higher) blocks, right goes to older (lower) blocks
  // This matches the homepage where newer blocks are on the left
  const navigateNewer = useCallback(() => {
    if (blockRange && blockHeight < blockRange.max) {
      router.push(`/block/${blockHeight + 1}`);
    }
  }, [blockHeight, blockRange, router]);

  const navigateOlder = useCallback(() => {
    if (blockRange && blockHeight > blockRange.min) {
      router.push(`/block/${blockHeight - 1}`);
    }
  }, [blockHeight, blockRange, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigateNewer();
      } else if (e.key === 'ArrowRight') {
        navigateOlder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateNewer, navigateOlder]);

  const canNavigateNewer = blockRange && blockHeight < blockRange.max;
  const canNavigateOlder = blockRange && blockHeight > blockRange.min;

  // Top 99 users for the leaderboard
  const leaderboard = blockData?.users.slice(0, 99) || [];

  // Scatter chart effect
  useEffect(() => {
    if (!chartRef.current || !blockData || leaderboard.length === 0) return;

    const chart = echarts.init(chartRef.current);

    const scatterData = leaderboard.map((user, index) => [index + 1, user.difficulty]);

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        left: 60,
        right: 20,
        top: 20,
        bottom: 40,
      },
      xAxis: {
        type: 'value',
        name: 'Rank',
        nameLocation: 'middle',
        nameGap: 25,
        min: 1,
        max: Math.max(leaderboard.length, 10),
        axisLine: {
          lineStyle: { color: '#444444' }
        },
        axisLabel: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        splitLine: {
          lineStyle: { color: '#333333', opacity: 0.5 }
        },
        nameTextStyle: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        axisPointer: {
          label: { show: false }
        },
      },
      yAxis: {
        type: 'log',
        name: 'Difficulty',
        nameLocation: 'middle',
        nameGap: 45,
        axisLine: {
          lineStyle: { color: '#444444' }
        },
        axisLabel: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
          formatter: (value: number) => {
            if (value >= 1e9) return (value / 1e9).toFixed(0) + 'G';
            if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
            if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
            return value.toString();
          }
        },
        splitLine: {
          lineStyle: { color: '#333333', opacity: 0.5 }
        },
        nameTextStyle: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        axisPointer: {
          label: { show: false }
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#222222',
        borderColor: '#444444',
        textStyle: {
          color: '#ededed',
          fontFamily: '"Courier New", Courier, monospace',
        },
        axisPointer: {
          type: 'line',
          snap: true,
          lineStyle: {
            color: '#ef4444',
            type: 'dashed',
            opacity: 0.7,
          },
          label: {
            show: false,
          },
        },
        formatter: (params: { data: number[] }[]) => {
          if (!params || params.length === 0) return '';
          const [rank, diff] = params[0].data;
          const user = leaderboard[rank - 1];
          return `#${rank} ${formatAddress(user?.fullAddress || '')}<br/>Difficulty: ${formatDifficulty(diff)}`;
        }
      },
      series: [{
        type: 'scatter',
        data: scatterData,
        symbolSize: 8,
        itemStyle: {
          color: '#ef4444',
          shadowBlur: 6,
          shadowColor: '#ef4444',
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            shadowBlur: 10,
          },
        },
      }],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [blockData, leaderboard]);

  return (
    <main className="flex min-h-screen flex-col items-start py-8">
      {/* Header with navigation */}
      <div className="w-full mb-6">
        {/* Block Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={navigateNewer}
            disabled={!canNavigateNewer}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-accent-1/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Block {blockHeight + 1}</span>
          </button>

          <a 
            href={`https://mempool.space/block/${blockHeight}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xl lg:text-3xl font-bold hover:text-accent-1 transition-colors"
          >
            Block #{blockHeight}
          </a>

          <button
            onClick={navigateOlder}
            disabled={!canNavigateOlder}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-accent-1/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Block {blockHeight - 1}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="w-full">
          <div className="animate-pulse">
            <div className="h-24 bg-foreground/5 border border-border mb-6"></div>
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-foreground/5 border border-border"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="w-full flex flex-col items-center justify-center py-16">
          <div className="text-accent-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-lg text-accent-2 mb-2">{error}</p>
          <p className="text-sm text-accent-3">
            Try navigating to a different block or check the block range above.
          </p>
        </div>
      )}

      {/* Block Data */}
      {blockData && !loading && (
        <div className="w-full">
          {/* Scatter Chart */}
          <div className="bg-background border border-border mb-6">
            <div ref={chartRef} className="w-full h-64" />
          </div>

          {/* Leaderboard Table */}
          <div className="bg-background border border-border">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold">Difficulty Leaderboard</h3>
            </div>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-foreground/5">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-accent-3 w-16">Rank</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-accent-3">Address</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-accent-3">Difficulty</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-accent-3 w-28">% of Top</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user, index) => {
                    const percentOfWinner = (user.difficulty / blockData.winner.difficulty) * 100;
                    const isWinner = index === 0;
                    
                    return (
                      <tr 
                        key={user.fullAddress} 
                        className={`border-b border-border/50 hover:bg-foreground/5 transition-colors ${isWinner ? 'bg-accent-1/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`font-mono ${isWinner ? 'text-accent-1 font-bold' : 'text-accent-3'}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            href={`/user/${user.fullAddress}`}
                            className="font-mono text-sm hover:text-accent-1 transition-colors"
                            title={user.fullAddress}
                          >
                            {formatAddress(user.fullAddress)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${isWinner ? 'text-accent-1' : ''}`}>
                            {formatDifficulty(user.difficulty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-accent-2 font-mono">
                            {percentOfWinner.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/50">
              {leaderboard.map((user, index) => {
                const percentOfWinner = (user.difficulty / blockData.winner.difficulty) * 100;
                const isWinner = index === 0;
                
                return (
                  <div 
                    key={user.fullAddress} 
                    className={`p-4 ${isWinner ? 'bg-accent-1/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-mono text-sm ${isWinner ? 'text-accent-1 font-bold' : 'text-accent-3'}`}>
                        #{index + 1}
                      </span>
                      <span className={`font-bold ${isWinner ? 'text-accent-1' : ''}`}>
                        {formatDifficulty(user.difficulty)}
                      </span>
                    </div>
                    <Link 
                      href={`/user/${user.fullAddress}`}
                      className="font-mono text-xs text-accent-2 hover:text-accent-1 transition-colors block"
                      title={user.fullAddress}
                    >
                      {formatAddress(user.fullAddress)}
                    </Link>
                    <div className="mt-2 text-xs text-accent-3 font-mono">
                      {percentOfWinner.toFixed(1)}% of top
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

