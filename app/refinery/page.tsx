'use client';

import { useState, useEffect, useCallback } from 'react';
import CardHeader from '@/app/components/CardHeader';
import CreateOrderModal from '@/app/components/modals/CreateOrderModal';
import OrderDetailModal from '@/app/components/modals/OrderDetailModal';
import DemandChart from '@/app/components/refinery/DemandChart';
import OrdersTable, { ordersToRows } from '@/app/components/refinery/OrdersTable';
import Calculator from '@/app/components/refinery/Calculator';
import { useWallet } from '@/app/hooks/useWallet';
import type { CapacityPoint, OrderTimelinePoint } from '@/app/api/refinery/types';
import { useRefineryStatus } from './RefineryShell';
import { useRefineryResource } from '@/app/hooks/useRefineryResource';
import { usePaginatedRefineryOrders } from '@/app/hooks/usePaginatedRefineryOrders';

const ACTIVE_STATUSES = 'active,in_mempool';

export default function RefineryPage() {
  const { address } = useWallet();
  const { status, unavailable: statusUnavailable } = useRefineryStatus();
  const {
    orders: activeOrders,
    page: activeOrdersPage,
    unavailable: ordersUnavailable,
    loading: ordersLoading,
    loadingMore: ordersLoadingMore,
    hasMore: ordersHasMore,
    refresh: refreshOrders,
    loadMore: loadMoreOrders,
    loadPrevious: loadPreviousOrders,
  } = usePaginatedRefineryOrders(`/api/refinery/orders?status=${ACTIVE_STATUSES}&kind=bucket`);
  const myOrdersUrl = address ? `/api/refinery/orders?address=${encodeURIComponent(address)}` : null;
  const {
    orders: myOrders,
    page: myOrdersPage,
    unavailable: myOrdersUnavailable,
    loading: myOrdersLoading,
    loadingMore: myOrdersLoadingMore,
    hasMore: myOrdersHasMore,
    refresh: refreshMyOrders,
    loadMore: loadMoreMyOrders,
    loadPrevious: loadPreviousMyOrders,
  } = usePaginatedRefineryOrders(myOrdersUrl);
  const activeCountUrl = `/api/refinery/orders/count?status=${ACTIVE_STATUSES}&kind=bucket`;
  const { data: activeCountData, refresh: refreshActiveCount } =
    useRefineryResource<{ count: number }>(activeCountUrl);
  const myOrdersCountUrl = address ? `/api/refinery/orders/count?address=${encodeURIComponent(address)}` : null;
  const { data: myOrdersCountData, refresh: refreshMyOrdersCount } =
    useRefineryResource<{ count: number }>(myOrdersCountUrl);
  const { data: timelineData, unavailable: timelineUnavailable, loading: timelineLoading, refresh: refreshTimeline } =
    useRefineryResource<OrderTimelinePoint[]>('/api/refinery/orders/timeline');
  const { data: capacityData, unavailable: capacityUnavailable, loading: capacityLoading, refresh: refreshCapacity } =
    useRefineryResource<CapacityPoint[]>('/api/refinery/capacity/historical');
  const [orderFilter, setOrderFilter] = useState<'all' | 'mine'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [calculatorKey, setCalculatorKey] = useState(0);

  // Fall back to "Active" when the wallet disconnects.
  useEffect(() => {
    if (!address) setOrderFilter('all');
  }, [address]);

  const timeline = timelineData ?? [];
  const capacity = capacityData ?? [];
  const demandUnavailable = timelineUnavailable || capacityUnavailable;

  // Sink orders have no work target and pending (unpaid) orders have not
  // started; only live bucket orders are shown.
  const bucketOrders = activeOrders.filter(
    o => o.requested_hash_days != null && o.requested_hash_days > 0 &&
         (o.status === 'active' || o.status === 'in_mempool'),
  );
  const rows = ordersToRows(bucketOrders);
  const displayedRows = orderFilter === 'mine' ? ordersToRows(myOrders) : rows;
  const displayedUnavailable = orderFilter === 'mine' ? myOrdersUnavailable : ordersUnavailable;
  const displayedLoading = orderFilter === 'mine' ? myOrdersLoading : ordersLoading;
  const displayedLoadingMore = orderFilter === 'mine' ? myOrdersLoadingMore : ordersLoadingMore;
  const displayedHasMore = orderFilter === 'mine' ? myOrdersHasMore : ordersHasMore;
  const displayedLoadMore = orderFilter === 'mine' ? loadMoreMyOrders : loadMoreOrders;
  const displayedLoadPrevious = orderFilter === 'mine' ? loadPreviousMyOrders : loadPreviousOrders;
  const displayedPage = orderFilter === 'mine' ? myOrdersPage : activeOrdersPage;
  const activeTotal = activeCountData?.count ?? null;
  const myOrdersTotal = myOrdersCountData?.count ?? null;
  const displayedTotal = orderFilter === 'mine' ? myOrdersTotal : activeTotal;
  const activeCountLabel = activeTotal != null
    ? String(activeTotal)
    : `${rows.length}${ordersHasMore ? '+' : ''}`;
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const handleCreated = useCallback(async () => {
    await Promise.all([
      refreshOrders(),
      refreshMyOrders(),
      refreshActiveCount(),
      refreshMyOrdersCount(),
      refreshTimeline(),
      refreshCapacity(),
    ]);
  }, [
    refreshActiveCount,
    refreshCapacity,
    refreshMyOrders,
    refreshMyOrdersCount,
    refreshOrders,
    refreshTimeline,
  ]);

  const filterTabClass = (tab: 'all' | 'mine') =>
    `px-2 py-0.5 ${orderFilter === tab ? 'bg-foreground text-background' : 'text-foreground/60 hover:text-foreground'}`;

  return (
    <>
      <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader title="Demand" className="mb-4" titleClassName="text-xl font-semibold" />
        {demandUnavailable && <p className="text-sm text-amber-400 mb-3">{timeline.length || capacity.length ? 'Demand data delayed; showing the last update.' : 'Demand data unavailable.'}</p>}
        <DemandChart points={timeline} capacity={capacity} loading={timelineLoading || capacityLoading} />
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
              `Orders (${activeCountLabel})`
            )
          }
          className="mb-4"
          titleClassName="text-xl font-semibold"
          action={status ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/80"
            >
              {statusUnavailable || status.halt ? 'Check availability' : 'Create Order'}
            </button>
          ) : null}
        />
        {displayedUnavailable && (
          <p className="text-sm text-amber-400 mb-3">{displayedRows.length ? 'Orders delayed; showing the last update.' : 'Orders unavailable.'}</p>
        )}
        {displayedLoading && displayedRows.length === 0 ? (
          <p className="text-sm text-foreground/60">Loading orders…</p>
        ) : (
          <OrdersTable
            key={orderFilter}
            rows={displayedRows}
            page={displayedPage}
            onOrderClick={setSelectedOrderId}
            hasMore={displayedHasMore}
            loadingMore={displayedLoadingMore}
            onLoadMore={displayedLoadMore}
            onLoadPrevious={displayedLoadPrevious}
            total={displayedTotal}
          />
        )}
      </div>

      <div id="calculator" className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              Calculator
              <button
                onClick={() => setCalculatorKey(k => k + 1)}
                title="Reset to defaults"
                aria-label="Reset calculator to defaults"
                className="text-foreground/60 hover:text-foreground"
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

      {isModalOpen && (
        <CreateOrderModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onCreated={handleCreated}
          address={address}
        />
      )}
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}
