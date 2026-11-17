'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SortableTable from './SortableTable';
import ShadowBlockTopDiffChart from './ShadowBlockTopDiffChart';
import { getShadowBlockTopDiffs } from '../utils/api';
import { SHADOW_BLOCK_POLL_INTERVAL_MS, type ShadowBlockTopDiff } from '../utils/shadow-block';
import { formatDifficulty } from '../utils/hashmath';
import { formatRelativeTime } from '../utils/formatters';
import { sortTableData, type SortDirection } from '../utils/sort';

interface ShadowBlockTopDiffRow {
  block_height: number;
  block_timestamp: number | null;
  difficulty: number | null;
  top_diff_address: string | null;
}

const DEFAULT_SORT_COLUMN: keyof ShadowBlockTopDiffRow = 'difficulty';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

interface ShadowBlockTopDiffsTableProps {
  initialSelectedHeight: number | null;
}

export default function ShadowBlockTopDiffsTable({
  initialSelectedHeight,
}: ShadowBlockTopDiffsTableProps) {
  const [diffs, setDiffs] = useState<ShadowBlockTopDiff[]>([]);
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

    async function fetchTopDiffs(isInitial: boolean) {
      if (isInitial) setLoading(true);

      try {
        const data = await getShadowBlockTopDiffs();
        if (cancelled) return;

        setError(null);
        setDiffs(data);
      } catch {
        if (cancelled) return;
        if (isInitial) setError('Failed to fetch shadow block top diffs');
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    let intervalId: number | undefined;

    fetchTopDiffs(true)
      .then(() => {
        // Start polling only after the first fetch settles so a slow initial
        // request can't overlap with the next one.
        if (!cancelled) {
          intervalId = window.setInterval(
            () => fetchTopDiffs(false),
            SHADOW_BLOCK_POLL_INTERVAL_MS,
          );
        }
      });

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const rows = useMemo<ShadowBlockTopDiffRow[]>(
    () => diffs.map((diff) => ({
      block_height: diff.block_height,
      block_timestamp: diff.block_timestamp,
      difficulty: diff.difficulty,
      top_diff_address: diff.top_diff_address,
    })),
    [diffs],
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

    const row = document.getElementById(`top-diff-${selectedHeight}`);
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
      key: 'difficulty' as keyof ShadowBlockTopDiffRow,
      header: 'Difficulty',
      render: (value: ShadowBlockTopDiffRow[keyof ShadowBlockTopDiffRow]) => {
        if (value === null) return <span className="text-accent-3">—</span>;
        return <span className="font-semibold">{formatDifficulty(Number(value))}</span>;
      },
    },
    {
      key: 'block_height' as keyof ShadowBlockTopDiffRow,
      header: 'Block',
      render: (value: ShadowBlockTopDiffRow[keyof ShadowBlockTopDiffRow]) => {
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
      key: 'top_diff_address' as keyof ShadowBlockTopDiffRow,
      header: 'Top Diff',
      render: (value: ShadowBlockTopDiffRow[keyof ShadowBlockTopDiffRow]) => (
        value !== null
          ? <span className="font-mono text-sm">{String(value)}</span>
          : <span className="text-accent-3">No public top diff</span>
      ),
    },
    {
      key: 'block_timestamp' as keyof ShadowBlockTopDiffRow,
      header: 'Time',
      render: (value: ShadowBlockTopDiffRow[keyof ShadowBlockTopDiffRow]) => {
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
        <h1 className="text-2xl lg:text-3xl font-bold">24h Shadow Block Top Diffs</h1>
      </div>

      {loading && (
        <div className="w-full text-foreground/60">Loading top diffs...</div>
      )}

      {error && !loading && (
        <div className="w-full py-16 text-center text-accent-2">{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="w-full border border-border bg-background p-6 text-center text-accent-2">
          No top diffs available for the last 24 hours.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {hasChartData && (
            <ShadowBlockTopDiffChart
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
              getRowId={(row) => `top-diff-${row.block_height}`}
              onRowClick={(row) => selectBlock(row.block_height)}
              rowClassName={(row) => (
                row.block_height === selectedHeight ? 'top-diff-selected-row' : ''
              )}
            />
          </div>
        </>
      )}
    </main>
  );
}
