'use client';

import { useState } from 'react';

function RefineryOperatorMedal({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size}>
      <circle cx="24" cy="24" r="22" fill="#b0b0b0" />
      <circle cx="24" cy="24" r="18.5" fill="#1a1a1a" />

      <g transform="translate(24 20) scale(1.35) translate(-10 -10)">
        <path
          d="M3 17V11h2V3h3v8h4V5h3v6h2v6H3z"
          fill="#d8d8d8"
        />
        <path
          d="M6.2 6.2h1.1v4.8H6.2zM13.2 8.1h1.1V11h-1.1zM4.6 14h10.8v1.2H4.6z"
          fill="#1a1a1a"
        />
        <path
          d="M5.7 12.2h1.2v1H5.7zM8.2 12.2h1.2v1H8.2zM10.7 12.2h1.2v1h-1.2zM13.2 12.2h1.2v1h-1.2z"
          fill="#f7931a"
        />
        <rect x="4.55" y="2.55" width="4.1" height="0.85" rx="0.42" fill="#f7931a" />
        <rect x="11.55" y="4.55" width="4.1" height="0.85" rx="0.42" fill="#f7931a" />
      </g>

      <text
        x="24"
        y="35.2"
        textAnchor="middle"
        fill="#e0d0aa"
        fontSize="3.7"
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="bold"
      >
        REFINERY
      </text>
      <text
        x="24"
        y="39"
        textAnchor="middle"
        fill="#e0d0aa"
        fontSize="3.7"
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="bold"
      >
        OPERATOR
      </text>
    </svg>
  );
}

export default function RefineryOperatorBadge() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div
        onClick={() => setFullscreen(true)}
        className="group relative inline-flex flex-col items-center transition-transform duration-150 hover:scale-[1.15] cursor-pointer"
      >
        <RefineryOperatorMedal size={44} />

        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded shadow-lg text-xs whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          Refinery Operator
        </div>
      </div>

      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
        >
          <RefineryOperatorMedal size={Math.min(480, typeof window !== 'undefined' ? window.innerWidth - 64 : 480)} />
        </div>
      )}
    </>
  );
}
