interface BlockBadgeProps {
  blockHeight: number;
  index?: number;
}

export default function BlockBadge({ blockHeight, index = 0 }: BlockBadgeProps) {
  const formattedHeight = String(blockHeight);

  return (
    <a
      href={`https://mempool.space/block/${blockHeight}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex flex-col items-center no-underline transition-transform duration-150 hover:scale-[1.15]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <svg viewBox="0 0 48 48" width={44} height={44}>
        {/* Outer ring */}
        <circle cx="24" cy="24" r="22" fill="#b0b0b0" />

        {/* Medal face */}
        <circle cx="24" cy="24" r="18.5" fill="#1a1a1a" />

        {/* Inner ring detail */}
        <circle
          cx="24" cy="24" r="16"
          fill="none"
          stroke="#555"
          strokeWidth="0.5"
          strokeOpacity="0.6"
        />

        {/* Crossed pickaxes */}
        <g opacity="0.8" transform="translate(24, 19)">
          <g transform="rotate(-35)">
            <rect
              x="-0.8" y="-9" width="1.6" height="15" rx="0.8"
              fill="#ccc"
            />
            <path
              d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z"
              fill="#ccc"
            />
          </g>
          <g transform="rotate(35)">
            <rect
              x="-0.8" y="-9" width="1.6" height="15" rx="0.8"
              fill="#ccc"
            />
            <path
              d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z"
              fill="#ccc"
            />
          </g>
        </g>

        {/* Block height text */}
        <text
          x="24" y="34"
          textAnchor="middle"
          fill="#ddd"
          fontSize="7.5"
          fontFamily="'Courier New', Courier, monospace"
          fontWeight="bold"
        >
          {formattedHeight}
        </text>
      </svg>

      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded shadow-lg text-xs whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        Mined on Block {formattedHeight}
      </div>
    </a>
  );
}
