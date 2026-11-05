'use client';

import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import CardHeader from './CardHeader';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from './collapsible';
import { formatHashDays } from '@/app/utils/hashmath';
import CreateOrderModal from './modals/CreateOrderModal';
import OrderDetailModal from './modals/OrderDetailModal';
import { RefineryIcon, InfoIcon } from '@/app/components/icons';
import type { RouterStatus } from '@/app/api/refinery/types';
import OrdersTable, { ordersToRows } from './refinery/OrdersTable';
import { useRefineryResource } from '@/app/hooks/useRefineryResource';
import { usePaginatedRefineryOrders } from '@/app/hooks/usePaginatedRefineryOrders';

interface RefineryProps {
  address: string;
  isLoading?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Refinery({ address, isLoading = false, collapsed = false, onToggle }: RefineryProps) {
  const { data: status, unavailable: statusUnavailable, loading: statusLoading } =
    useRefineryResource<RouterStatus>('/api/refinery/status', !isLoading);
  const ordersUrl = `/api/refinery/orders?address=${encodeURIComponent(address)}`;
  const {
    orders: ordersData,
    page: ordersPage,
    unavailable: ordersUnavailable,
    loading: ordersLoading,
    loadingMore,
    hasMore,
    refresh: refreshOrders,
    loadMore,
    loadPrevious,
  } = usePaginatedRefineryOrders(ordersUrl, !isLoading);
  const ordersCountUrl = `/api/refinery/orders/count?address=${encodeURIComponent(address)}`;
  const { data: ordersCountData, refresh: refreshOrdersCount } =
    useRefineryResource<{ count: number }>(ordersCountUrl, !isLoading);
  const ordersTotal = ordersCountData?.count ?? null;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
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

  const capacity = status?.total_capacity_hash_days ?? 0;
  const used = status?.used_capacity_hash_days ?? 0;
  const rows = useMemo(() => ordersToRows(ordersData), [ordersData]);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const handleOrdersCreated = useCallback(async () => {
    await Promise.all([refreshOrders(), refreshOrdersCount()]);
  }, [refreshOrders, refreshOrdersCount]);

  if (isLoading || statusLoading || (!status && !statusUnavailable)) {
    return (
      <div className={containerClassName} onClick={handleClick}>
        <CardHeader
          title="Refinery"
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

  if (!status) {
    return (
      <div className={containerClassName} onClick={handleClick}>
        <CardHeader title="Refinery" icon={<RefineryIcon />} />
        {!collapsed && <p className="text-sm text-foreground/60 mt-4">Refinery status unavailable; retrying…</p>}
      </div>
    );
  }

  return (
    <div className={containerClassName} onClick={handleClick}>
      <CardHeader
        title="Refinery"
        icon={<RefineryIcon />}
        className={collapsed ? '' : 'mb-4'}
        action={collapsed ? null : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/80"
          >
            {statusUnavailable || status.halt ? 'Check availability' : 'Create Order'}
          </button>
        )}
      />

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Capacity</p>
              <p className="text-lg font-semibold">{formatHashDays(capacity)}</p>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Used</p>
              <p className="text-lg font-semibold">{formatHashDays(used)}</p>
            </div>
            <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
              <p className="text-sm text-foreground/60">Hashprice</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                {status.hash_price.toLocaleString()} sats/PHd
                <span className="relative inline-flex group" data-collapse-ignore>
                  <InfoIcon className="h-4 w-4 text-foreground/60 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 w-56 p-2 bg-background border border-border rounded shadow-lg text-xs font-normal text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    PHd (petahash-day): Work done by 1 PH/s over 1 day. Conceptually like a KWh (kilowatt-hour).
                  </span>
                </span>
              </p>
            </div>
          </div>

          {ordersUnavailable && <p className="text-sm text-amber-400 mb-3">{rows.length ? 'Orders delayed; showing the last update.' : 'Orders unavailable.'}</p>}
          {ordersLoading && rows.length === 0 ? (
            <p className="text-sm text-foreground/60 mt-4">Loading orders…</p>
          ) : (
            <OrdersTable
              rows={rows}
              page={ordersPage}
              onOrderClick={setSelectedOrderId}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              onLoadPrevious={loadPrevious}
              total={ordersTotal}
            />
          )}
        </>
      )}

      {isModalOpen && <CreateOrderModal isOpen={isModalOpen} onClose={closeModal} onCreated={handleOrdersCreated} address={address} />}
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
