import type { ReactNode } from 'react';

interface StackedMedalProps {
  /** Number of times this badge has been earned. Medal renders when >= 1. */
  count: number;
  /** Tooltip text shown on hover. */
  tooltip: string;
  /** Inner SVG icon group (drawn on the medal face). */
  icon: ReactNode;
  /** When false, never render the count bubble (count still gates rendering). */
  showCount?: boolean;
  /** When provided, renders the medal as a clickable button instead of a static div. */
  onClick?: () => void;
}

/**
 * A single stacking-badge medal with an optional count bubble. The bubble shows
 * the total count and is hidden for a single instance (count of 1).
 */
export default function StackedMedal({ count, tooltip, icon, showCount = true, onClick }: StackedMedalProps) {
  if (count <= 0) return null;

  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? { type: 'button' as const, onClick, 'aria-label': tooltip }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative inline-flex flex-col items-center transition-transform duration-150 hover:scale-[1.15]${
        onClick ? ' cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-3 rounded-full' : ''
      }`}
    >
      <svg viewBox="0 0 48 48" width={44} height={44}>
        <circle cx="24" cy="24" r="22" fill="#b0b0b0" />
        <circle cx="24" cy="24" r="18.5" fill="#1a1a1a" />
        <circle cx="24" cy="24" r="16" fill="none" stroke="#555" strokeWidth="0.5" strokeOpacity="0.6" />
        {icon}
      </svg>

      {showCount && count > 1 && (
        <span className="pointer-events-none absolute -top-1 -right-1 min-w-[18px] rounded-full bg-[#b0b0b0] px-1 text-center text-[10px] font-bold leading-[18px] text-black ring-2 ring-background shadow">
          {count}
        </span>
      )}

      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded shadow-lg text-xs whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150">
        {tooltip}
      </span>
    </Wrapper>
  );
}
