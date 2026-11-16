'use client';

import { useParams } from 'next/navigation';
import CardHeader from '@/app/components/CardHeader';
import OrderDetailFields from '@/app/components/refinery/OrderDetailFields';
import { useRefineryResource } from '@/app/hooks/useRefineryResource';
import type { OrderDetail } from '@/app/api/refinery/types';

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const rawId = params.id ?? '';
  const parsedId = Number(rawId);
  const orderId = /^\d+$/.test(rawId) && Number.isSafeInteger(parsedId) ? parsedId : null;
  const detailUrl = orderId != null ? `/api/refinery/order/${orderId}` : null;
  const { data: detail, unavailable, loading } = useRefineryResource<OrderDetail>(detailUrl);

  if (orderId == null) {
    return (
      <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
        <CardHeader title="Order" className="mb-4" titleClassName="text-xl font-semibold" />
        <p className="text-sm text-foreground/60">Invalid order ID.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-background border border-border p-4 sm:p-6 shadow-sm">
      <CardHeader
        title={`Order #${orderId}`}
        className="mb-4"
        titleClassName="text-xl font-semibold"
      />
      {unavailable && (
        <p className="text-sm text-amber-400 mb-3">
          {detail ? 'Order details delayed; showing the last update.' : 'Order details unavailable.'}
        </p>
      )}
      {loading && !detail ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-secondary border border-border p-3 flex flex-col gap-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          ))}
        </div>
      ) : detail ? (
        <OrderDetailFields detail={detail} />
      ) : !unavailable ? (
        <p className="text-sm text-foreground/60">Loading order…</p>
      ) : null}
    </div>
  );
}
