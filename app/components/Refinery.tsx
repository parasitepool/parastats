'use client';

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react';
import CardHeader from './CardHeader';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from './collapsible';
import SortableTable from './SortableTable';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/formatters';
import CreateOrderModal from './modals/CreateOrderModal';
import { RefineryIcon, InfoIcon } from '@/app/components/icons';
import type { OrderDetail, RouterStatus } from '@/app/api/router/types';

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
  isLoading?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Refinery({ address, isLoading = false, collapsed = false, onToggle }: RefineryProps) {
  const [status, setStatus] = useState<RouterStatus | null>(null);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const containerClassName = getCollapsibleContainerClassName(
    'w-full bg-background border border-border p-4 sm:p-6 shadow-sm',
    collapsed,
    Boolean(onToggle),
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onToggle || !shouldToggleCollapse(event, '[data-collapse-ignore]')) {
      return;
    }

    onToggle();
  };

  const fetchOrders = useCallback(async () => {
    const ordersUrl = new URL('/api/router/orders', window.location.origin);
    ordersUrl.searchParams.set('address', address);
    const res = await fetch(ordersUrl, { cache: 'no-store' }).catch(() => null);
    if (!mountedRef.current) return;
    if (res?.ok) setOrders(await res.json());
  }, [address]);

  useEffect(() => {
    if (isLoading) return;

    const fetchAll = async () => {
      const ordersUrl = new URL('/api/router/orders', window.location.origin);
      ordersUrl.searchParams.set('address', address);

      const [statusRes, ordersRes] = await Promise.all([
        fetch('/api/router/status').catch(() => null),
        fetch(ordersUrl, { cache: 'no-store' }).catch(() => null),
      ]);

      if (!mountedRef.current) return;

      if (statusRes?.ok) setStatus(await statusRes.json());
      if (ordersRes?.ok) setOrders(await ordersRes.json());
    };

    fetchAll();
    const intervalId = setInterval(fetchAll, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [address, isLoading]);

  const capacity = status?.capacity_hashrate ?? 0;
  const available = status?.available_hashrate ?? 0;

  const rows = useMemo<OrderRow[]>(() =>
    orders.map(o => ({
      id: o.id,
      status: o.status,
      requested: o.kind === 'sink' ? null : o.kind.bucket,
      hashrate: o.downstream.hashrate_1m,
      best_share: o.upstream?.stats.best_share ?? o.downstream.best_share ?? 0,
      delivered: o.upstream?.stats.hash_days ?? 0,
    })),
  [orders]);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  if (isLoading) {
    return (
      <div className={containerClassName} onClick={handleClick}>
        <CardHeader
          title={<>Refinery <span className="text-sm font-normal text-foreground/60">(beta)</span></>}
          icon={<RefineryIcon />}
          className={collapsed ? '' : 'mb-4'}
        />

        {!collapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center gap-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center gap-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center gap-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className={containerClassName} onClick={handleClick}>
      <CardHeader
        title={<>Refinery <span className="text-sm font-normal text-foreground/60">(beta)</span></>}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Capacity</p>
              <p className="text-lg font-semibold">{formatHashrate(capacity)}</p>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Available</p>
              <p className="text-lg font-semibold">{formatHashrate(available)}</p>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Hashprice</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {status.hash_price.toLocaleString()} sats/PHd
                <span className="relative inline-flex group" data-collapse-ignore>
                  <InfoIcon className="h-4 w-4 text-foreground/60 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 w-56 p-2 bg-background border border-border rounded shadow-lg text-xs font-normal text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    PHd = petahash-day: Work done by 1 PH/s over 1 day
                  </span>
                </span>
              </p>
            </div>
          </div>

          <div className="hidden md:block" data-collapse-ignore>
            <SortableTable
              data={rows}
              columns={columns}
              defaultSortColumn="id"
              defaultSortDirection="desc"
            />
          </div>

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
        </>
      )}

      <CreateOrderModal isOpen={isModalOpen} onClose={closeModal} onCreated={fetchOrders} address={address} hashPrice={status.hash_price} />
    </div>
  );
}
