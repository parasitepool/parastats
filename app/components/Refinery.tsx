'use client';

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react';
import CardHeader from './CardHeader';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from './collapsible';
import { formatHashDays } from '@/app/utils/formatters';
import CreateOrderModal from './modals/CreateOrderModal';
import OrderDetailModal from './modals/OrderDetailModal';
import { RefineryIcon, InfoIcon } from '@/app/components/icons';
import type { OrderSummary, RouterStatus } from '@/app/api/router/types';
import OrdersTable, { ordersToRows } from './refinery/OrdersTable';

interface RefineryProps {
  address: string;
  isLoading?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Refinery({ address, isLoading = false, collapsed = false, onToggle }: RefineryProps) {
  const [status, setStatus] = useState<RouterStatus | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
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
        fetch('/api/router/status', { cache: 'no-store' }).catch(() => null),
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

  const capacity = status?.total_capacity_hash_days ?? 0;
  const used = status?.used_capacity_hash_days ?? 0;

  const rows = useMemo(() => ordersToRows(orders), [orders]);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  if (isLoading) {
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

  if (!status) return null;

  return (
    <div className={containerClassName} onClick={handleClick}>
      <CardHeader
        title="Refinery"
        icon={<RefineryIcon />}
        className={collapsed ? '' : 'mb-4'}
        action={collapsed ? null : (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={status.halt}
            className={`px-4 py-2 text-sm font-medium ${status.halt ? 'bg-foreground/40 text-background/60 cursor-not-allowed' : 'bg-foreground text-background hover:bg-foreground/80'}`}
          >
            {status.halt ? 'Paused' : 'Create Order'}
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

          <OrdersTable rows={rows} onOrderClick={setSelectedOrderId} />
        </>
      )}

      <CreateOrderModal isOpen={isModalOpen} onClose={closeModal} onCreated={fetchOrders} address={address} hashPrice={status.hash_price} halt={status.halt} />
      <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
