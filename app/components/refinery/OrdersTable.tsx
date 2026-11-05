'use client';

import SortableTable from '../SortableTable';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/hashmath';
import type { OrderSummary, Review } from '@/app/api/refinery/types';

export interface OrderRow {
  id: number;
  status: string;
  review: Review;
  requested: number | null;
  hashrate: number;
  best_share: number | null;
  progress: number;
}

export const statusColor: Record<string, string> = {
  active: 'text-green-500',
  pending: 'text-[#f7931a]',
  in_mempool: 'text-yellow-500',
};

export function ReviewBadge({ review }: { review: Review }) {
  if (review === 'flagged') return <span className="text-red-500 text-sm ml-1" title="Flagged for review">⚑</span>;
  if (review === 'cleared') return <span className="text-foreground/40 text-sm ml-1" title="Cleared">✓</span>;
  return null;
}

export function ordersToRows(orders: OrderSummary[]): OrderRow[] {
  return orders.map(o => ({
    id: o.id,
    status: o.status,
    review: o.review,
    requested: o.requested_hash_days,
    hashrate: o.hashrate,
    best_share: o.best_share,
    progress: o.requested_hash_days ? Math.min(100, (o.delivered_hash_days / o.requested_hash_days) * 100) : 0,
  }));
}

// A sink order has no target at all; a bucket order always does.
function formatRequested(row: Pick<OrderRow, 'requested'>): string {
  return row.requested != null ? formatHashDays(row.requested) : 'Unlimited';
}

function OrderProgressBar({ progress, requested }: { progress: number; requested: number | null }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-3 bg-secondary border border-border rounded-full overflow-hidden">
        <div
          className="h-full bg-[rgba(237,237,237,0.6)] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-foreground/60 w-10 text-right">
        {requested ? `${Math.round(progress)}%` : '—'}
      </span>
    </div>
  );
}

const columns = [
  {
    key: 'id' as keyof OrderRow,
    header: 'ID',
  },
  {
    key: 'status' as keyof OrderRow,
    header: 'Status',
    render: (value: OrderRow[keyof OrderRow], row: OrderRow) => (
      <span className="inline-flex items-center">
        <span className={statusColor[String(value)] ?? ''}>{String(value)}</span>
        <ReviewBadge review={row.review} />
      </span>
    ),
  },
  {
    key: 'requested' as keyof OrderRow,
    header: 'Requested',
    render: (_value: OrderRow[keyof OrderRow], row: OrderRow) => formatRequested(row),
  },
  {
    key: 'hashrate' as keyof OrderRow,
    header: 'Hashrate',
    render: (value: OrderRow[keyof OrderRow]) => formatHashrate(Number(value)),
  },
  {
    key: 'best_share' as keyof OrderRow,
    header: 'Best Share',
    render: (value: OrderRow[keyof OrderRow]) =>
      value != null ? formatDifficulty(Number(value)) : '—',
  },
  {
    key: 'progress' as keyof OrderRow,
    header: 'Progress',
    render: (_value: OrderRow[keyof OrderRow], row: OrderRow) => (
      <OrderProgressBar progress={row.progress} requested={row.requested} />
    ),
  },
];

interface OrdersTableProps {
  rows: OrderRow[];
  page?: number;
  onOrderClick?: (id: number) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  onLoadPrevious?: () => void | Promise<void>;
  total?: number | null;
}

export default function OrdersTable({
  rows,
  page = 0,
  onOrderClick,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onLoadPrevious,
  total = null,
}: OrdersTableProps) {
  const loadedThrough = page * 10 + rows.length;
  const totalForDisplay = total != null ? Math.max(total, loadedThrough) : loadedThrough;
  const rangeStart = page * 10 + 1;

  return (
    <>
      <div className="hidden md:block" data-collapse-ignore>
        <SortableTable
          data={rows}
          columns={columns}
          defaultSortColumn="id"
          defaultSortDirection="desc"
          pageSize={10}
          page={page}
          onRowClick={onOrderClick ? (row) => onOrderClick(row.id) : undefined}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          onLoadPrevious={onLoadPrevious}
          total={total}
        />
      </div>

      <div className="md:hidden space-y-4">
        {rows.map(order => (
          <div
            key={order.id}
            className={`bg-background border border-border p-4 shadow-sm ${onOrderClick ? 'cursor-pointer hover:bg-foreground/5' : ''}`}
            onClick={onOrderClick ? () => onOrderClick(order.id) : undefined}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-accent-3 font-bold text-lg">
                Order {order.id}
              </span>
              <span className="inline-flex items-center">
                <span className={`font-medium ${statusColor[order.status] ?? ''}`}>{order.status}</span>
                <ReviewBadge review={order.review} />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground/60">Requested</p>
                <p className="font-medium">{formatRequested(order)}</p>
              </div>
              <div>
                <p className="text-foreground/60">Hashrate</p>
                <p className="font-medium">{formatHashrate(order.hashrate)}</p>
              </div>
              <div>
                <p className="text-foreground/60">Best Share</p>
                <p className="font-medium">{order.best_share != null ? formatDifficulty(order.best_share) : '—'}</p>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <p className="text-foreground/60 mb-2">Progress</p>
              <OrderProgressBar progress={order.progress} requested={order.requested} />
            </div>
          </div>
        ))}
        {(page > 0 || (rows.length > 0 && hasMore)) && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-foreground/60">
              {rows.length > 0 ? `${rangeStart}–${loadedThrough}` : '0–0'} of {totalForDisplay}{total == null && hasMore ? '+' : ''}
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={page === 0 || loadingMore || !onLoadPrevious}
                onClick={onLoadPrevious}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={!hasMore || loadingMore || !onLoadMore}
                onClick={onLoadMore}
              >
                {loadingMore ? 'Loading…' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
