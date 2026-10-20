'use client';

import { formatHashDays } from '@/app/utils/formatters';
import { RefineryIcon } from '@/app/components/icons';
import type { RouterStatus } from '@/app/api/router/types';

interface RouterStatsProps {
  status: RouterStatus | null;
}

function SkeletonCard() {
  return (
    <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center gap-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
    </div>
  );
}

function TitleCard() {
  return (
    <div className="bg-secondary border border-border p-3 min-h-[88px] flex items-center justify-center gap-2">
      <RefineryIcon className="h-8 w-8" />
      <h1 className="text-xl font-semibold">Refinery</h1>
    </div>
  );
}

export default function RouterStats({ status }: RouterStatsProps) {
  if (!status) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TitleCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const capacity = status.total_capacity_hash_days;
  const used = status.used_capacity_hash_days;
  const usedPercent = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <TitleCard />

      <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
        <p className="text-sm text-foreground/60">Hashprice</p>
        <p className="text-lg font-semibold">{status.hash_price.toLocaleString()} sats/PHd</p>
      </div>

      <div className="bg-secondary border border-border p-3 min-h-[88px] flex flex-col justify-center">
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
          <span className="text-xs text-foreground/60">{usedPercent.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
