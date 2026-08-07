// Inner SVG icon groups for badge medals. Each is drawn inside a 48x48 medal
// face (see MedalFrame / StackedMedal / BlockWinnerBadge).

export function PickaxeIcon() {
  return (
    <g opacity="0.8" transform="translate(24, 22)">
      <g transform="rotate(-35)">
        <rect x="-0.8" y="-9" width="1.6" height="15" rx="0.8" fill="#ccc" />
        <path d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z" fill="#ccc" />
      </g>
      <g transform="rotate(35)">
        <rect x="-0.8" y="-9" width="1.6" height="15" rx="0.8" fill="#ccc" />
        <path d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z" fill="#ccc" />
      </g>
    </g>
  );
}

export function TrophyIcon() {
  return (
    <g transform="translate(24 23) scale(0.9)" fill="#f7d774">
      <path d="M-6-9h12v3a6 6 0 0 1-12 0z" />
      <path d="M-6-8h-2.5a2.5 2.5 0 0 0 2.5 4zM6-8h2.5a2.5 2.5 0 0 1-2.5 4z" fill="none" stroke="#f7d774" strokeWidth="1.1" />
      <rect x="-1.2" y="-3" width="2.4" height="5" />
      <rect x="-4" y="2" width="8" height="1.8" rx="0.6" />
      <rect x="-2.8" y="3.6" width="5.6" height="1.8" rx="0.6" />
    </g>
  );
}

export function LoyaltyIcon() {
  return (
    <g transform="translate(24 22)">
      {/* ribbon */}
      <path d="M-3 2l-2.5 7 3.5-1.8L-1 12l1.5-6z" fill="#c0392b" />
      <path d="M3 2l2.5 7-3.5-1.8L1 12l-1.5-6z" fill="#c0392b" />
      {/* medal disc */}
      <circle cx="0" cy="-1" r="6.5" fill="#f7d774" stroke="#d8b24a" strokeWidth="0.8" />
      <path d="M0-5.2l1.4 2.9 3.2.4-2.3 2.2.6 3.1L0 3.9l-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill="#c9962f" />
    </g>
  );
}

export function DispenserIcon() {
  return (
    <g transform="translate(24 22)">
      {/* globe */}
      <circle cx="0" cy="-3.5" r="6" fill="#7fd1e8" opacity="0.85" />
      <circle cx="-2" cy="-5" r="1.4" fill="#e74c3c" />
      <circle cx="2.2" cy="-4" r="1.4" fill="#f1c40f" />
      <circle cx="0" cy="-1.5" r="1.4" fill="#2ecc71" />
      <circle cx="-2.4" cy="-1.6" r="1.2" fill="#9b59b6" />
      <circle cx="2.6" cy="-1.4" r="1.2" fill="#e67e22" />
      {/* base + chute */}
      <path d="M-6 2h12l-1.5 6h-9z" fill="#d8d8d8" />
      <rect x="-2" y="4.6" width="4" height="2.2" rx="0.5" fill="#1a1a1a" />
    </g>
  );
}

/** Bravocado: a spotted mushroom cap on a pale stem. */
export function MushroomIcon() {
  return (
    <g transform="translate(24 21)">
      {/* stem */}
      <path d="M-2.6 0h5.2v6.6a2.6 2.6 0 0 1-5.2 0z" fill="#f2e3c8" />
      <path d="M-2.6 0h2v9a2.6 2.6 0 0 1-2-2.4z" fill="#dbc9a6" />
      {/* cap */}
      <path d="M-9.5 0a9.5 8 0 0 1 19 0z" fill="#d0392f" />
      <ellipse cx="-4.6" cy="-2.5" rx="1.8" ry="1.4" fill="#f7ede0" />
      <ellipse cx="0.8" cy="-4.4" rx="1.5" ry="1.2" fill="#f7ede0" />
      <ellipse cx="5.4" cy="-1.7" rx="1.3" ry="1" fill="#f7ede0" />
    </g>
  );
}

/** Miner: an ASIC chassis with a fan and heat vents. */
export function MinerRigIcon() {
  return (
    <g transform="translate(24 24)">
      {/* chassis */}
      <rect x="-10.5" y="-7" width="21" height="14" rx="1.8" fill="#d8d8d8" />
      <rect x="-10.5" y="-7" width="21" height="14" rx="1.8" fill="none" stroke="#8a8a8a" strokeWidth="0.6" />
      {/* fan */}
      <circle cx="-4.2" cy="0" r="4.8" fill="#1a1a1a" />
      <circle cx="-4.2" cy="0" r="3.8" fill="none" stroke="#8a8a8a" strokeWidth="0.6" />
      <g fill="#f7931a">
        <ellipse cx="-4.2" cy="-2.1" rx="1" ry="2" />
        <ellipse cx="-2.4" cy="1.1" rx="1" ry="2" transform="rotate(-60 -2.4 1.1)" />
        <ellipse cx="-6" cy="1.1" rx="1" ry="2" transform="rotate(60 -6 1.1)" />
        <circle cx="-4.2" cy="0" r="1" />
      </g>
      {/* heat vents */}
      <rect x="2.4" y="-4.6" width="6.6" height="1.4" rx="0.7" fill="#1a1a1a" />
      <rect x="2.4" y="-2" width="6.6" height="1.4" rx="0.7" fill="#1a1a1a" />
      <rect x="2.4" y="0.6" width="6.6" height="1.4" rx="0.7" fill="#1a1a1a" />
      {/* status light */}
      <circle cx="8.2" cy="4.4" r="1.1" fill="#2ecc71" />
    </g>
  );
}

/** Auction winner: a gavel resting on its striking block. */
export function GavelIcon() {
  return (
    <g transform="translate(24 21)">
      <g transform="rotate(-40)">
        {/* handle */}
        <rect x="-1.1" y="-3" width="2.2" height="12" rx="1.1" fill="#c9962f" />
        {/* head */}
        <rect x="-5" y="-9.5" width="10" height="6" rx="1.2" fill="#f7d774" />
        <rect x="-5" y="-9.5" width="2" height="6" rx="0.8" fill="#c9962f" />
        <rect x="3" y="-9.5" width="2" height="6" rx="0.8" fill="#c9962f" />
      </g>
      {/* striking block */}
      <rect x="-8.5" y="8" width="17" height="2.8" rx="1.4" fill="#b0b0b0" />
    </g>
  );
}

export function RefineryIcon() {
  return (
    <g transform="translate(24 20) scale(1.15) translate(-10 -10)">
      <path d="M3 17V11h2V3h3v8h4V5h3v6h2v6H3z" fill="#d8d8d8" />
      <path d="M6.2 6.2h1.1v4.8H6.2zM13.2 8.1h1.1V11h-1.1zM4.6 14h10.8v1.2H4.6z" fill="#1a1a1a" />
      <path d="M5.7 12.2h1.2v1H5.7zM8.2 12.2h1.2v1H8.2zM10.7 12.2h1.2v1h-1.2zM13.2 12.2h1.2v1h-1.2z" fill="#f7931a" />
      <rect x="4.55" y="2.55" width="4.1" height="0.85" rx="0.42" fill="#f7931a" />
      <rect x="11.55" y="4.55" width="4.1" height="0.85" rx="0.42" fill="#f7931a" />
    </g>
  );
}
