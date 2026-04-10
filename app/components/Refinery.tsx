'use client';

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import CardHeader from './CardHeader';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from './collapsible';
import SortableTable from './SortableTable';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/formatters';
import CreateOrderModal from './modals/CreateOrderModal';
import { RefineryIcon } from '@/app/components/icons';

interface OrderDetail {
  id: number;
  status: string;
  target_work: number | null;
  upstream: { hash_days: number } | null;
  stats: { hashrate_1m: number; hash_days: number; best_share: number };
}

interface RefineryStatus {
  orders: OrderDetail[];
  stats: { hashrate_1m: number };
  used: number;
}

interface OrderRow {
  id: number;
  status: string;
  requested: number | null;
  hashrate: number;
  best_share: number;
  delivered: number;
}

function statusColor(status: string): string {
  if (status === 'active') return 'text-green-500';
  if (status === 'fulfilled') return 'text-blue-500';
  if (status === 'pending') return 'text-yellow-500';
  if (status === 'cancelled' || status === 'disconnected' || status === 'expired') return 'text-red-500';
  if (status === 'paid_late') return 'text-orange-500';
  return 'text-foreground';
}

const columns = [
  {
    key: 'id' as keyof OrderRow,
    header: 'ID',
  },
  {
    key: 'status' as keyof OrderRow,
    header: 'Status',
    render: (value: OrderRow[keyof OrderRow]) => <span className={statusColor(String(value))}>{value}</span>,
  },
  {
    key: 'requested' as keyof OrderRow,
    header: 'Requested',
    render: (value: OrderRow[keyof OrderRow]) => value != null ? formatHashDays(Number(value)) : 'Unlimited',
  },
  {
    key: 'delivered' as keyof OrderRow,
    header: 'Delivered',
    render: (value: OrderRow[keyof OrderRow]) => formatHashDays(Number(value)),
  },
  {
    key: 'hashrate' as keyof OrderRow,
    header: 'Hashrate',
    render: (value: OrderRow[keyof OrderRow]) => formatHashrate(Number(value)),
  },
  {
    key: 'best_share' as keyof OrderRow,
    header: 'Best Share',
    render: (value: OrderRow[keyof OrderRow]) => formatDifficulty(Number(value)),
  },
];

interface RefineryProps {
  address: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Refinery({ address, collapsed = false, onToggle }: RefineryProps) {
  const [status, setStatus] = useState<RefineryStatus | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerClassName = getCollapsibleContainerClassName(
    'w-full mt-6 mb-6 bg-background border border-border p-4 sm:p-6 shadow-sm',
    collapsed,
    Boolean(onToggle),
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onToggle || !shouldToggleCollapse(event, '[data-collapse-ignore]')) {
      return;
    }

    onToggle();
  };

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const url = new URL('/api/router/status', window.location.origin);
        url.searchParams.set('address', address);
        const res = await fetch(url);
        if (!res.ok) {
          if (mounted) setStatus(null);
          return;
        }
        const data: RefineryStatus = await res.json();
        if (mounted) setStatus(data);
      } catch {
        if (mounted) setStatus(null);
      }
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [address]);

  const capacity = status?.stats.hashrate_1m ?? 0;
  const used = status?.used ?? 0;

  const rows = useMemo<OrderRow[]>(() => {
    if (!status) return [];
    return status.orders.map(o => ({
      id: o.id,
      status: o.status,
      requested: o.target_work,
      hashrate: o.stats.hashrate_1m,
      best_share: o.stats.best_share,
      delivered: o.upstream?.hash_days ?? 0,
    }));
  }, [status]);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <div className={containerClassName} onClick={handleClick}>
      <CardHeader
        title="Refinery"
        icon={<RefineryIcon />}
        className={collapsed ? '' : 'mb-4'}
        action={collapsed ? null : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80"
          >
            Create Order
          </button>
        )}
      />

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Capacity</p>
              <p className="text-lg font-semibold">{formatHashrate(capacity)}</p>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Used</p>
              <p className="text-lg font-semibold">{formatHashrate(used)}</p>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="hidden md:block" data-collapse-ignore>
              <SortableTable
                data={rows}
                columns={columns}
                defaultSortColumn="id"
                defaultSortDirection="desc"
              />
            </div>
          )}

          {rows.length > 0 && (
            <div className="md:hidden space-y-4">
              {rows.map(order => (
                <div key={order.id} className="bg-background border border-border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent-3 font-bold text-lg">
                      Order {order.id}
                    </span>
                    <span className={`font-medium ${statusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-foreground/60">Requested</p>
                      <p className="font-medium">{order.requested != null ? formatHashDays(order.requested) : 'Unlimited'}</p>
                    </div>
                    <div>
                      <p className="text-foreground/60">Delivered</p>
                      <p className="font-medium">{formatHashDays(order.delivered)}</p>
                    </div>
                    <div>
                      <p className="text-foreground/60">Hashrate</p>
                      <p className="font-medium">{formatHashrate(order.hashrate)}</p>
                    </div>
                    <div>
                      <p className="text-foreground/60">Best Share</p>
                      <p className="font-medium">{formatDifficulty(order.best_share)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <CreateOrderModal isOpen={isModalOpen} onClose={closeModal} address={address} />
    </div>
  );
}
