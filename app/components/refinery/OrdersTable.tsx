'use client';

import Link from 'next/link';
import SortableTable from '../SortableTable';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/hashmath';
import { orderHref } from '@/app/utils/refinery-links';
import OrderProgressBar, { orderProgress } from './OrderProgressBar';
import { ReviewBadge, statusColor } from './order-status';
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

export function ordersToRows(orders: OrderSummary[]): OrderRow[] {
  return orders.map(o => ({
    id: o.id,
    status: o.status,
    review: o.review,
    requested: o.requested_hash_days,
    hashrate: o.hashrate,
    best_share: o.best_share,
    progress: orderProgress(o.delivered_hash_days, o.requested_hash_days),
  }));
}

// A sink order has no target at all; a bucket order always does.
function formatRequested(row: Pick<OrderRow, 'requested'>): string {
  return row.requested != null ? formatHashDays(row.requested) : 'Unlimited';
}

const columns = [
  {
    key: 'id' as keyof OrderRow,
    header: 'ID',
    render: (value: OrderRow[keyof OrderRow]) => (
      <Link
        href={orderHref(Number(value))}
        aria-label={`View order ${value}`}
        className="hover:text-accent-3 hover:underline"
        onClick={event => event.stopPropagation()}
      >
        {String(value)}
      </Link>
    ),
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
      <OrderProgressBar
        progress={row.progress}
        requested={row.requested}
        label={`Order ${row.id} progress`}
      />
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

      <div className="md:hidden space-y-3" data-collapse-ignore>
        {rows.map(order => {
          const cardClassName = 'bg-background border border-border p-4 shadow-sm';
          const content = (
            <>
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
                <OrderProgressBar
                  progress={order.progress}
                  requested={order.requested}
                  label={`Order ${order.id} progress`}
                />
              </div>
            </>
          );

          return onOrderClick ? (
            <Link
              key={order.id}
              href={orderHref(order.id)}
              aria-label={`View order ${order.id}`}
              className={`block ${cardClassName} hover:bg-foreground/5`}
            >
              {content}
            </Link>
          ) : (
            <div key={order.id} className={cardClassName}>
              {content}
            </div>
          );
        })}
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
