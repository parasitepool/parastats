import type { Review } from '@/app/api/refinery/types';

export const statusColor: Record<string, string> = {
  active: 'text-green-500',
  pending: 'text-[#f7931a]',
  in_mempool: 'text-yellow-500',
};

export function ReviewBadge({ review }: { review: Review }) {
  if (review === 'flagged') return <span className="text-red-500 text-sm ml-1" title="Flagged for review">⚑</span>;
  if (review === 'cleared') return <span className="text-foreground/40 text-sm ml-1" title="Cleared">✓</span>;
  return null;
}
