'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatHashDays, formatPercent } from '@/app/utils/hashmath';
import { RefineryIcon } from '@/app/components/icons';
import type { RouterStatus } from '@/app/api/refinery/types';

interface RouterStatsProps {
  status: RouterStatus | null;
  unavailable?: boolean;
}

function SkeletonCard({
  unavailable,
  className = 'flex',
}: {
  unavailable: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-secondary border border-border p-3 min-h-[88px] ${className} flex-col justify-center gap-2`}>
      {unavailable ? (
        <p className="text-sm text-foreground/60">Status unavailable</p>
      ) : (
        <>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
        </>
      )}
    </div>
  );
}

function TitleCard({ docsActive }: { docsActive: boolean }) {
  return (
    <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-wrap items-center justify-center gap-2">
      <Link href="/refinery" className="flex items-center gap-2 transition-colors hover:text-accent-3">
        <RefineryIcon className="h-8 w-8 shrink-0" />
        <h1 className="text-xl font-semibold">Refinery</h1>
      </Link>
      <Link
        href={docsActive ? '/refinery' : '/refinery/docs'}
        aria-label={docsActive ? 'Close docs and return to Refinery' : 'Open docs'}
        className={`shrink-0 border px-2 py-1 text-xs font-medium transition-colors duration-200 ${docsActive
          ? 'border-foreground bg-foreground text-background'
          : 'border-foreground/40 text-foreground hover:border-foreground hover:bg-foreground/10'}`}
      >
        Docs
      </Link>
    </div>
  );
}

export default function RouterStats({ status, unavailable = false }: RouterStatsProps) {
  const pathname = usePathname();
  // Order and docs pages need the vertical space on mobile; keep only the
  // Refinery title card there.
  const compactOnMobile =
    pathname.startsWith('/refinery/order/') || pathname.startsWith('/refinery/docs');
  const secondaryCardClass = compactOnMobile ? 'hidden sm:flex' : 'flex';
  const docsActive = pathname === '/refinery/docs';

  if (!status) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TitleCard docsActive={docsActive} />
        <SkeletonCard unavailable={unavailable} className={secondaryCardClass} />
        <SkeletonCard unavailable={unavailable} className={secondaryCardClass} />
      </div>
    );
  }

  const capacity = status.total_capacity_hash_days;
  const used = status.used_capacity_hash_days;
  const usedPercent = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <TitleCard docsActive={docsActive} />

      <div className={`bg-secondary border border-border p-3 min-h-[88px] ${secondaryCardClass} flex-col justify-center`}>
        <p className="text-sm text-foreground/60">Hashprice</p>
        <p className="text-lg font-semibold">{status.hash_price.toLocaleString()} sats/PHd</p>
      </div>

      <div className={`bg-secondary border border-border p-3 min-h-[88px] ${secondaryCardClass} flex-col justify-center`}>
        <p className="text-sm text-foreground/60">Capacity</p>
        <p className="text-lg font-semibold">
          {formatHashDays(used)} <span className="text-foreground/60">/ {formatHashDays(capacity)}</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-background border border-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[rgba(237,237,237,0.6)] rounded-full transition-all duration-300"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <span className="text-xs text-foreground/60">{formatPercent(usedPercent)}</span>
        </div>
      </div>
    </div>
  );
}
