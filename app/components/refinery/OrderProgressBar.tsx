interface OrderProgressBarProps {
  progress: number;
  requested: number | null;
  label?: string;
  trackClassName?: string;
}

/** Clamped percentage of requested work delivered for an order. */
export function orderProgress(delivered: number, requested: number | null): number {
  return requested ? Math.min(100, (delivered / requested) * 100) : 0;
}

export default function OrderProgressBar({
  progress,
  requested,
  label = 'Order progress',
  trackClassName = 'bg-secondary',
}: OrderProgressBarProps) {
  const percent = requested ? Math.round(progress) : null;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className={`flex-1 h-3 ${trackClassName} border border-border rounded-full overflow-hidden`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent !== null ? `${percent}%` : 'Unlimited'}
      >
        <div
          className="h-full bg-[rgba(237,237,237,0.6)] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-foreground/60 w-10 text-right">
        {percent !== null ? `${percent}%` : '—'}
      </span>
    </div>
  );
}
