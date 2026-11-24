'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { formatDifficulty, formatPercent } from '@/app/utils/hashmath';
import { escapeHtml } from '@/app/utils/formatters';
import { parseBlockParam } from '@/app/utils/shadow-block';
import { ChevronLeftIcon, ChevronRightIcon } from '@/app/components/icons';

const LEADERBOARD_MAX_USERS = 99;
const BLOCK_RANGE_WINDOW = 499;

interface BlockData {
  block_height: number;
  block_timestamp: number | null;
  top_diff: {
    address: string;
    claimed?: boolean;
    difficulty: number;
  } | null;
  users: {
    address: string;
    claimed?: boolean;
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
  const blockHeight = parseBlockParam(params.height);

  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [blockRange, setBlockRange] = useState<BlockRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBlockRange = async () => {
      try {
        const response = await fetch('/api/highest-diff?limit=1');
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled && data.length > 0) {
          const latestBlock = data[0].block_height;
          setBlockRange({
            min: Math.max(1, latestBlock - BLOCK_RANGE_WINDOW),
            max: latestBlock,
          });
        }
      } catch {
        console.error('Failed to fetch block range');
      }
    };

    fetchBlockRange();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (blockHeight === null) {
      setError('Invalid block height');
      setBlockData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchBlockData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/highest-diff/${blockHeight}`);
        if (cancelled) return;
        if (!response.ok) {
          setError(
            response.status === 404
              ? 'No difficulty data found for this block'
              : 'Failed to fetch block data',
          );
          setBlockData(null);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setBlockData(data);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to fetch block data');
          setBlockData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBlockData();

    return () => {
      cancelled = true;
    };
  }, [blockHeight]);

  const navigateNewer = useCallback(() => {
    if (blockHeight !== null && blockRange && blockHeight < blockRange.max) {
      router.push(`/block/${blockHeight + 1}`);
    }
  }, [blockHeight, blockRange, router]);

  const navigateOlder = useCallback(() => {
    if (blockHeight !== null && blockRange && blockHeight > blockRange.min) {
      router.push(`/block/${blockHeight - 1}`);
    }
  }, [blockHeight, blockRange, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as Element;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        navigateNewer();
      } else if (e.key === 'ArrowRight') {
        navigateOlder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateNewer, navigateOlder]);

  const canNavigateNewer = blockHeight !== null && blockRange !== null && blockHeight < blockRange.max;
  const canNavigateOlder = blockHeight !== null && blockRange !== null && blockHeight > blockRange.min;

  const leaderboard = useMemo(
    () => blockData?.users.slice(0, LEADERBOARD_MAX_USERS) || [],
    [blockData?.users],
  );

  const scatterData = useMemo(
    () => leaderboard.flatMap((user, index) => (
      user.difficulty > 0 ? [[index + 1, user.difficulty] as [number, number]] : []
    )),
    [leaderboard],
  );

  const topDifficulty = blockData?.top_diff?.difficulty ?? 0;

  useEffect(() => {
    const node = chartRef.current;
    if (loading || !node || !blockData || scatterData.length === 0) return;

    const chart = echarts.init(node);

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        left: 70,
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
          lineStyle: { color: '#444444' },
        },
        axisLabel: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        splitLine: {
          lineStyle: { color: '#333333', opacity: 0.5 },
        },
        nameTextStyle: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        axisPointer: {
          label: { show: false },
        },
      },
      yAxis: {
        type: 'log',
        name: 'Difficulty',
        nameLocation: 'middle',
        nameGap: 58,
        axisLine: {
          lineStyle: { color: '#444444' },
        },
        axisLabel: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
          formatter: (value: number) => formatDifficulty(value),
        },
        splitLine: {
          lineStyle: { color: '#333333', opacity: 0.5 },
        },
        nameTextStyle: {
          color: '#888888',
          fontFamily: '"Courier New", Courier, monospace',
        },
        axisPointer: {
          label: { show: false },
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
          const address = escapeHtml(user?.address || '');
          return `#${rank} <span style="color:#ededed">${address}</span><br/>Difficulty: ${formatDifficulty(diff)}`;
        },
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

    chart.setOption(option, { notMerge: true });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [blockData, leaderboard, scatterData, loading]);

  return (
    <main className="flex min-h-screen flex-col items-start py-8">
      <div className="w-full mb-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={navigateNewer}
            disabled={!canNavigateNewer}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-accent-1/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon />
            {blockHeight !== null && (
              <span className="hidden sm:inline">Block {blockHeight + 1}</span>
            )}
          </button>

          {blockHeight !== null ? (
            <a
              href={`https://mempool.space/block/${blockHeight}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl lg:text-3xl font-bold hover:text-accent-1 transition-colors"
            >
              Block #{blockHeight}
            </a>
          ) : (
            <h1 className="text-2xl lg:text-3xl font-bold">Invalid Block</h1>
          )}

          <button
            onClick={navigateOlder}
            disabled={!canNavigateOlder}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-accent-1/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {blockHeight !== null && (
              <span className="hidden sm:inline">Block {blockHeight - 1}</span>
            )}
            <ChevronRightIcon />
          </button>
        </div>
      </div>

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

      {blockData && !loading && leaderboard.length === 0 && (
        <div className="w-full border border-border bg-background p-8 text-center text-accent-2">
          No public difficulty data available for this block.
        </div>
      )}

      {blockData && !loading && leaderboard.length > 0 && (
        <div className="w-full">
          {scatterData.length > 0 && (
            <div className="bg-background border border-border mb-6">
              <div ref={chartRef} className="w-full h-64" />
            </div>
          )}

          <div className="bg-background border border-border">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold">Difficulty Leaderboard</h3>
            </div>

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
                    const percentOfTop = topDifficulty > 0 ? (user.difficulty / topDifficulty) * 100 : 0;
                    const isTopDiff = index === 0;

                    return (
                      <tr
                        key={`${index}-${user.address}`}
                        className={`border-b border-border/50 hover:bg-foreground/5 transition-colors ${isTopDiff ? 'bg-accent-1/5' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`font-mono ${isTopDiff ? 'text-accent-1 font-bold' : 'text-accent-3'}`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">
                            {user.address}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${isTopDiff ? 'text-accent-1' : ''}`}>
                            {formatDifficulty(user.difficulty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-accent-2 font-mono">
                            {formatPercent(percentOfTop)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border/50">
              {leaderboard.map((user, index) => {
                const percentOfTop = topDifficulty > 0 ? (user.difficulty / topDifficulty) * 100 : 0;
                const isTopDiff = index === 0;

                return (
                  <div
                    key={`${index}-${user.address}`}
                    className={`p-4 ${isTopDiff ? 'bg-accent-1/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-mono text-sm ${isTopDiff ? 'text-accent-1 font-bold' : 'text-accent-3'}`}>
                        #{index + 1}
                      </span>
                      <span className={`font-bold ${isTopDiff ? 'text-accent-1' : ''}`}>
                        {formatDifficulty(user.difficulty)}
                      </span>
                    </div>
                    <span className="font-mono text-xs block text-accent-2">
                      {user.address}
                    </span>
                    <div className="mt-2 text-xs text-accent-3 font-mono">
                      {formatPercent(percentOfTop)} of top
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
