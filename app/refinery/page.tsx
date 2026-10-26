'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CardHeader from '@/app/components/CardHeader';
import CreateOrderModal from '@/app/components/modals/CreateOrderModal';
import RouterStats from '@/app/components/refinery/RouterStats';
import DemandChart from '@/app/components/refinery/DemandChart';
import OrdersTable, { ordersToRows } from '@/app/components/refinery/OrdersTable';
import Calculator from '@/app/components/refinery/Calculator';
import { useWallet } from '@/app/hooks/useWallet';
import type { CapacityPoint, OrderSummary, OrderTimelinePoint, RouterStatus } from '@/app/api/router/types';

const ACTIVE_STATUSES = 'active,in_mempool';

export default function RefineryPage() {
  const { address } = useWallet();
  const [status, setStatus] = useState<RouterStatus | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [myOrders, setMyOrders] = useState<OrderSummary[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'mine'>('all');
  const [timeline, setTimeline] = useState<OrderTimelinePoint[]>([]);
  const [capacity, setCapacity] = useState<CapacityPoint[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calculatorKey, setCalculatorKey] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    const ordersUrl = new URL('/api/router/orders', window.location.origin);
    ordersUrl.searchParams.set('status', ACTIVE_STATUSES);
    // Sink orders have no work target and would inflate the order count.
    ordersUrl.searchParams.set('kind', 'bucket');

    // No status filter: the connected user's full history, like the account page.
    let myOrdersUrl: URL | null = null;
    if (address) {
      myOrdersUrl = new URL('/api/router/orders', window.location.origin);
      myOrdersUrl.searchParams.set('address', address);
    }

    const [statusRes, ordersRes, timelineRes, capacityRes, myOrdersRes] = await Promise.all([
      fetch('/api/router/status', { cache: 'no-store' }).catch(() => null),
      fetch(ordersUrl, { cache: 'no-store' }).catch(() => null),
      fetch('/api/router/orders/timeline', { cache: 'no-store' }).catch(() => null),
      fetch('/api/router/capacity/historical', { cache: 'no-store' }).catch(() => null),
      myOrdersUrl ? fetch(myOrdersUrl, { cache: 'no-store' }).catch(() => null) : null,
    ]);

    if (!mountedRef.current) return;

    if (statusRes?.ok) setStatus(await statusRes.json());
    if (ordersRes?.ok) setOrders(await ordersRes.json());
    if (timelineRes?.ok) setTimeline(await timelineRes.json());
    if (capacityRes?.ok) setCapacity(await capacityRes.json());
    if (myOrdersRes?.ok) setMyOrders(await myOrdersRes.json());
    if (!myOrdersUrl) setMyOrders([]);
    setTimelineLoading(false);
  }, [address]);

  // Fall back to "Active" when the wallet disconnects.
  useEffect(() => {
    if (!address) setOrderFilter('all');
  }, [address]);

  useEffect(() => {
    fetchAll();
    const intervalId = setInterval(fetchAll, 30000);
    return () => clearInterval(intervalId);
  }, [fetchAll]);

  // Sink orders have no work target and pending (unpaid) orders have not
  // started; only live bucket orders are shown.
  const bucketOrders = orders.filter(
    o => o.requested_hash_days != null && o.requested_hash_days > 0 &&
         (o.status === 'active' || o.status === 'in_mempool'),
  );
  const rows = ordersToRows(bucketOrders);
  const displayedRows = orderFilter === 'mine' ? ordersToRows(myOrders) : rows;
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const filterTabClass = (tab: 'all' | 'mine') =>
    `px-2 py-0.5 ${orderFilter === tab ? 'bg-foreground text-background' : 'text-foreground/60 hover:text-foreground'}`;

  return (
    <main className="flex-grow py-4 space-y-4 sm:space-y-6">
      <RouterStats status={status} />

      <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader title="Demand" className="mb-4" titleClassName="text-xl font-semibold" />
        <DemandChart points={timeline} capacity={capacity} loading={timelineLoading} />
      </div>

      <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader
          title={
            address ? (
              <span className="inline-flex items-center gap-3 sm:gap-4">
                Orders
                <span className="inline-flex items-center gap-1 text-sm font-normal">
                  <button onClick={() => setOrderFilter('all')} className={filterTabClass('all')}>Active</button>
                  <button onClick={() => setOrderFilter('mine')} className={filterTabClass('mine')}>Mine</button>
                </span>
              </span>
            ) : (
              `Orders (${rows.length})`
            )
          }
          className="mb-4"
          titleClassName="text-xl font-semibold"
          action={status ? (
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={status.halt}
              className={`px-4 py-2 text-sm font-medium ${status.halt ? 'bg-foreground/40 text-background/60 cursor-not-allowed' : 'bg-foreground text-background hover:bg-foreground/80'}`}
            >
              {status.halt ? 'Paused' : 'Create Order'}
            </button>
          ) : null}
        />
        <OrdersTable rows={displayedRows} />
      </div>

      <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              Calculator
              <button
                onClick={() => setCalculatorKey(k => k + 1)}
                className="text-foreground/60 hover:text-foreground"
                title="Reset to defaults"
                aria-label="Reset calculator to defaults"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </span>
          }
          className="mb-4"
          titleClassName="text-xl font-semibold"
        />
        <Calculator key={calculatorKey} hashPrice={status?.hash_price ?? null} />
      </div>

      {status && (
        <CreateOrderModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onCreated={fetchAll}
          address={address}
          hashPrice={status.hash_price}
          halt={status.halt}
        />
      )}
    </main>
  );
}
