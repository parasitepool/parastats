import type { ReactNode } from 'react';
import { formatHashrate, formatHashDays, formatDifficulty } from '@/app/utils/hashmath';
import OrderProgressBar, { orderProgress } from './OrderProgressBar';
import { ReviewBadge, statusColor } from './order-status';
import type { OrderDetail } from '@/app/api/refinery/types';

interface OrderDetailFieldsProps {
  detail: OrderDetail;
}

function DetailField({
  label,
  children,
  className = '',
  valueClassName = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`bg-secondary p-3 border border-border ${className}`.trim()}>
      <p className="text-sm text-foreground/60">{label}</p>
      <p className={`text-foreground font-medium ${valueClassName}`.trim()}>{children}</p>
    </div>
  );
}

export default function OrderDetailFields({ detail }: OrderDetailFieldsProps) {
  const delivered = detail.upstream.delivered_hash_days;
  const requested = detail.requested_hash_days;
  const progress = orderProgress(delivered, requested);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DetailField label="Status" valueClassName="inline-flex items-center">
          <span className={statusColor[detail.status] ?? ''}>{detail.status}</span>
          <ReviewBadge review={detail.review} />
        </DetailField>
        <DetailField label="Hashrate">
          <span className="block">{formatHashrate(detail.upstream.hashrate_1m)}</span>
          {detail.target_hashrate != null && (
            <span className="block text-xs font-normal text-foreground/60">
              Target {formatHashrate(detail.target_hashrate)}
            </span>
          )}
        </DetailField>
        <div className="bg-secondary p-3 border border-border sm:col-span-2">
          <p className="text-sm text-foreground/60">Progress</p>
          <div className="mt-1">
            <OrderProgressBar
              progress={progress}
              requested={requested}
              trackClassName="bg-background"
              label="Order progress"
            />
          </div>
          <p className="text-xs text-foreground/60 mt-1">
            Delivered {formatHashDays(delivered)} / Requested{' '}
            {requested != null ? formatHashDays(requested) : 'Unlimited'}
          </p>
        </div>
        <DetailField label="Best Share">
          {detail.upstream.best_share != null ? formatDifficulty(detail.upstream.best_share) : '—'}
        </DetailField>
        <DetailField label="Hashprice">
          {detail.hash_price != null ? `${detail.hash_price.toLocaleString()} sats/PHd` : '—'}
        </DetailField>
        <DetailField label="Created">
          {new Date(detail.created_at * 1000).toLocaleString()}
        </DetailField>
        <DetailField label="Created at Block Height">
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
        </DetailField>
        <DetailField label="Endpoint" className="sm:col-span-2" valueClassName="break-all">
          {detail.upstream_target.endpoint}
        </DetailField>
        <DetailField label="Username" className="sm:col-span-2" valueClassName="break-all">
          {detail.upstream_target.username}
        </DetailField>
        <DetailField label="Payment Amount" className="sm:col-span-2">
          {detail.payment_amount != null ? `${detail.payment_amount.toLocaleString()} sats` : '—'}
        </DetailField>
        <DetailField label="Payment Address" className="sm:col-span-2" valueClassName="break-all">
          {detail.payment_address ? (
            <a
              href={`https://mempool.space/address/${detail.payment_address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-3 hover:underline"
            >
              {detail.payment_address}
            </a>
          ) : '—'}
        </DetailField>
      </div>

      {detail.txids.length > 0 && (
        <div className="bg-secondary p-3 border border-border">
          <p className="text-sm text-foreground/60 mb-2">Transactions</p>
          <div className="space-y-1">
            {detail.txids.map(txid => (
              <a
                key={txid}
                href={`https://mempool.space/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-foreground text-sm font-mono break-all hover:text-accent-3 hover:underline"
              >
                {txid}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
