import { TrophyIcon } from './icons';

interface BlockWinnerBadgeProps {
  blockHeight: number;
}

/** A unique medal for a block this miner's share actually solved. */
export default function BlockWinnerBadge({ blockHeight }: BlockWinnerBadgeProps) {
  return (
    <a
      href={`https://mempool.space/block/${blockHeight}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex flex-col items-center no-underline transition-transform duration-150 hover:scale-[1.15]"
    >
      <svg viewBox="0 0 48 48" width={44} height={44}>
        <circle cx="24" cy="24" r="22" fill="#e0b84a" />
        <circle cx="24" cy="24" r="18.5" fill="#1a1a1a" />
        <circle cx="24" cy="24" r="16" fill="none" stroke="#f7d774" strokeWidth="0.5" strokeOpacity="0.6" />
        <TrophyIcon />
        <text
          x="24" y="34"
          textAnchor="middle"
          fill="#f7d774"
          fontSize="7.5"
          fontFamily="'Courier New', Courier, monospace"
          fontWeight="bold"
        >
          {blockHeight}
        </text>
      </svg>

      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded shadow-lg text-xs whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        Won block {blockHeight}
      </div>
    </a>
  );
}
