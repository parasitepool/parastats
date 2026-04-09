'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import SortableTable from './SortableTable';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/formatters';
import CreateOrderModal from './modals/CreateOrderModal';

interface OrderDetail {
  id: number;
  status: string;
  target_work: number | null;
  stats: { hashrate_1m: number; hash_days: number; best_share: number };
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
  if (status === 'active' || status === 'fulfilled') return 'text-green-500';
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

export default function Orders({ address }: { address: string }) {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      try {
        const url = new URL('/api/router/orders', window.location.origin);
        url.searchParams.set('address', address);
        const idsRes = await fetch(url);
        if (!idsRes.ok) {
          if (mounted) setOrders([]);
          return;
        }
        const ids: number[] = await idsRes.json();
        if (ids.length === 0) {
          if (mounted) setOrders([]);
          return;
        }
        const results = await Promise.allSettled(
          ids.map(id => fetch(`/api/router/order/${id}`).then(r => {
            if (!r.ok) throw new Error(`${r.status}`);
            return r.json() as Promise<OrderDetail>;
          }))
        );
        if (!mounted) return;
        const fulfilled = results
          .filter((r): r is PromiseFulfilledResult<OrderDetail> => r.status === 'fulfilled')
          .map(r => r.value);
        setOrders(fulfilled);
      } catch {
        if (mounted) setOrders([]);
      }
    };

    fetchOrders();
    const intervalId = setInterval(fetchOrders, 30000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [address]);

  const rows = useMemo<OrderRow[]>(() =>
    orders.map(o => ({
      id: o.id,
      status: o.status,
      requested: o.target_work,
      hashrate: o.stats.hashrate_1m,
      best_share: o.stats.best_share,
      delivered: o.stats.hash_days,
    })),
    [orders]
  );

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <div className="w-full mt-6 mb-6 bg-background border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Orders ({rows.length})</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80"
        >
          Create Order
        </button>
      </div>

      {rows.length > 0 && (
        <div className="hidden md:block">
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

      <CreateOrderModal isOpen={isModalOpen} onClose={closeModal} address={address} />
    </div>
  );
}
