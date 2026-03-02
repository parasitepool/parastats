'use client';

export default function BlockBadge({ blockHeight }: { blockHeight: number | null }) {
  if (!blockHeight) return null;
  return (
    <sup
      className="ml-0.5 text-[9px] text-accent-1/70 cursor-help"
      title={`Contributed to pool's last found block #${blockHeight}`}
    >
      {blockHeight}
    </sup>
  );
}
