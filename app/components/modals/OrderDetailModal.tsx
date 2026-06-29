'use client';

import { useState, useEffect } from 'react';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/formatters';
import { ReviewBadge, statusColor } from '@/app/components/Refinery';
import type { OrderDetail } from '@/app/api/router/types';

interface OrderDetailModalProps {
  orderId: number | null;
  onClose: () => void;
}

export default function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === null) {
      setDetail(null);
      setError(null);
      return;
    }

    let stale = false;
    setLoading(true);
    setError(null);

    fetch(`/api/router/order/${orderId}`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
        return res.json();
      })
      .then(data => { if (!stale) setDetail(data); })
      .catch(err => { if (!stale) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!stale) setLoading(false); });

    return () => { stale = true; };
  }, [orderId]);

  useEffect(() => {
    if (orderId === null) return;
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [orderId, onClose]);

  if (orderId === null) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-3">Order {orderId}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-secondary border border-border p-3 flex flex-col gap-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4"></div>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
            {error}
          </div>
        )}

        {detail && !loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Status</p>
                <p className="text-foreground font-medium inline-flex items-center">
                  <span className={statusColor[detail.status] ?? ''}>{detail.status}</span>
                  <ReviewBadge review={detail.review} />
                </p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Hashrate</p>
                <p className="text-foreground font-medium">{formatHashrate(detail.upstream.hashrate_1m)}</p>
              </div>
              <div className="bg-secondary p-3 border border-border sm:col-span-2">
                <p className="text-sm text-foreground/60">Endpoint</p>
                <p className="text-foreground font-medium break-all">{detail.upstream_target.endpoint}</p>
              </div>
              <div className="bg-secondary p-3 border border-border sm:col-span-2">
                <p className="text-sm text-foreground/60">Username</p>
                <p className="text-foreground font-medium break-all">{detail.upstream_target.username}</p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Delivered</p>
                <p className="text-foreground font-medium">{formatHashDays(detail.upstream.delivered_hash_days)}</p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Requested</p>
                <p className="text-foreground font-medium">
                  {detail.requested_hash_days != null ? formatHashDays(detail.requested_hash_days) : 'Unlimited'}
                </p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Best Share</p>
                <p className="text-foreground font-medium">
                  {detail.upstream.best_share != null ? formatDifficulty(detail.upstream.best_share) : '—'}
                </p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Hashprice</p>
                <p className="text-foreground font-medium">
                  {detail.hash_price != null
                    ? `${detail.hash_price.toLocaleString()} sats/PHd`
                    : '—'}
                </p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Created</p>
                <p className="text-foreground font-medium">
                  {new Date(detail.created_at * 1000).toLocaleString()}
                </p>
              </div>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60">Created at Block Height</p>
                <p className="text-foreground font-medium">
                  {detail.created_at_height != null ? (
                    <a
                      href={`https://mempool.space/block/${detail.created_at_height}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-accent-3"
                    >
                      {detail.created_at_height.toLocaleString()}
                    </a>
                  ) : '—'}
                </p>
              </div>
            </div>

            {detail.txids?.length > 0 && (
              <div className="bg-secondary p-3 border border-border">
                <p className="text-sm text-foreground/60 mb-2">Transactions</p>
                <div className="space-y-1">
                  {detail.txids.map(txid => (
                    <p key={txid} className="text-foreground text-sm font-mono break-all">{txid}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
