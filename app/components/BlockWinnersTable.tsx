'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SortableTable from './SortableTable';
import WinnerDiffChart from './WinnerDiffChart';
import { getWinnerDiffs } from '../utils/api';
import { WINNER_POLL_INTERVAL_MS, type WinnerDiff } from '../utils/winners';
import { formatDifficulty } from '../utils/hashmath';
import { formatRelativeTime } from '../utils/formatters';
import { sortTableData, type SortDirection } from '../utils/sort';

interface WinnerRow {
  block_height: number;
  block_timestamp: number | null;
  difficulty: number | null;
  winner: string | null;
}

const DEFAULT_SORT_COLUMN: keyof WinnerRow = 'difficulty';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

interface BlockWinnersTableProps {
  initialSelectedHeight: number | null;
}

export default function BlockWinnersTable({ initialSelectedHeight }: BlockWinnersTableProps) {
  const [winners, setWinners] = useState<WinnerDiff[]>([]);
  const [selectedHeight, setSelectedHeight] = useState<number | null>(initialSelectedHeight);
  const [sort, setSort] = useState({
    column: DEFAULT_SORT_COLUMN,
    direction: DEFAULT_SORT_DIRECTION,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrolledSelectionRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedHeight(initialSelectedHeight);
  }, [initialSelectedHeight]);

  useEffect(() => {
    let cancelled = false;

    async function fetchWinners(isInitial: boolean) {
      if (isInitial) setLoading(true);

      try {
        const data = await getWinnerDiffs();
        if (cancelled) return;

        setError(null);
        setWinners(data);
      } catch {
        if (cancelled) return;
        if (isInitial) setError('Failed to fetch block winners');
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    fetchWinners(true);
    const intervalId = window.setInterval(
      () => fetchWinners(false),
      WINNER_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const rows = useMemo<WinnerRow[]>(
    () => winners.map((winner) => ({
      block_height: winner.block_height,
      block_timestamp: winner.block_timestamp,
      difficulty: winner.difficulty,
      winner: winner.top_diff_address,
    })),
    [winners],
  );

  const sortedRows = useMemo(
    () => sortTableData(rows, sort.column, sort.direction),
    [rows, sort.column, sort.direction],
  );

  const hasChartData = useMemo(
    () => rows.some((row) => row.difficulty !== null && row.difficulty > 0),
    [rows],
  );

  const selectBlock = useCallback((blockHeight: number) => {
    setSelectedHeight(blockHeight);

    const url = new URL(window.location.href);
    url.searchParams.set('block', String(blockHeight));
    window.history.replaceState(null, '', url);
  }, []);

  // Scroll to the selected block once when arriving from the share stream.
  useEffect(() => {
    if (loading || selectedHeight === null) return;
    if (scrolledSelectionRef.current === selectedHeight) return;

    const row = document.getElementById(`winner-${selectedHeight}`);
    if (!row) return;

    scrolledSelectionRef.current = selectedHeight;
    const rect = row.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading, selectedHeight, rows]);

  const columns = useMemo(() => [
    {
      key: 'difficulty' as keyof WinnerRow,
      header: 'Difficulty',
      render: (value: WinnerRow[keyof WinnerRow]) => {
        if (value === null) return <span className="text-accent-3">—</span>;
        return <span className="font-semibold">{formatDifficulty(Number(value))}</span>;
      },
    },
    {
      key: 'block_height' as keyof WinnerRow,
      header: 'Block',
      render: (value: WinnerRow[keyof WinnerRow]) => {
        const height = Number(value);
        return (
          <span className={`font-mono font-bold ${
            height === selectedHeight ? 'text-accent-1' : ''
          }`}>
            {height.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: 'winner' as keyof WinnerRow,
      header: 'Winner',
      render: (value: WinnerRow[keyof WinnerRow]) => (
        value !== null
          ? <span className="font-mono text-sm">{String(value)}</span>
          : <span className="text-accent-3">No public winner</span>
      ),
    },
    {
      key: 'block_timestamp' as keyof WinnerRow,
      header: 'Time',
      render: (value: WinnerRow[keyof WinnerRow]) => {
        if (value === null) return <span className="text-accent-3">—</span>;
        const timestamp = Number(value);
        return (
          <span title={new Date(timestamp * 1000).toLocaleString()}>
            {formatRelativeTime(timestamp)}
          </span>
        );
      },
    },
  ], [selectedHeight]);

  return (
    <main className="flex min-h-screen flex-col items-start gap-3 py-8">
      <div className="w-full">
        <h1 className="text-2xl lg:text-3xl font-bold">24h Shadow Block Winners</h1>
      </div>

      {loading && (
        <div className="w-full text-foreground/60">Loading block winners...</div>
      )}

      {error && !loading && (
        <div className="w-full py-16 text-center text-accent-2">{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="w-full border border-border bg-background p-6 text-center text-accent-2">
          No winners available for the last 24 hours.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {hasChartData && (
            <WinnerDiffChart
              rows={sortedRows}
              selectedHeight={selectedHeight}
              onSelectBlock={selectBlock}
            />
          )}
          <div className="w-full border border-border bg-background">
            <SortableTable
              data={rows}
              columns={columns}
              defaultSortColumn={DEFAULT_SORT_COLUMN}
              defaultSortDirection={DEFAULT_SORT_DIRECTION}
              newColumnSortDirection="desc"
              onSortChange={(column, direction) => setSort({ column, direction })}
              getRowId={(row) => `winner-${row.block_height}`}
              onRowClick={(row) => selectBlock(row.block_height)}
              rowClassName={(row) => (
                row.block_height === selectedHeight ? 'winner-selected-row' : ''
              )}
            />
          </div>
        </>
      )}
    </main>
  );
}
