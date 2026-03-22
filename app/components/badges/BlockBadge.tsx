'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface BlockBadgeProps {
  blockHeight: number;
  rank: number;
  totalParticipants: number;
  isWinner: boolean;
  index?: number;
}

type MedalTier = 'gold' | 'silver' | 'bronze';

const TIER_COLORS = {
  gold: {
    face: ['#3d372a', '#332e22', '#29251b', '#201d15'],
    ring: ['#b8a878', '#7a6f4e', '#b8a878'],
    innerStroke: '#9a8a5a',
    icon: '#d4c8a0',
    text: '#e8dfc0',
    glow: '#a89868',
    glowStrength: 3,
    glowOpacity: 0.35,
  },
  silver: {
    face: ['#2e3035', '#252729', '#1c1e22', '#151618'],
    ring: ['#8a8e98', '#4a4d55', '#8a8e98'],
    innerStroke: '#606672',
    icon: '#b0b4be',
    text: '#c8ccd4',
    glow: '#6a7080',
    glowStrength: 1.5,
    glowOpacity: 0.15,
  },
  bronze: {
    face: ['#2a2420', '#211c18', '#191411', '#13100d'],
    ring: ['#6b5a48', '#3a3028', '#6b5a48'],
    innerStroke: '#504030',
    icon: '#8a7a68',
    text: '#9a8a78',
    glow: null,
    glowStrength: 0,
    glowOpacity: 0,
  },
} as const;

function getTier(rank: number, isWinner: boolean): MedalTier {
  if (isWinner || rank === 1) return 'gold';
  if (rank <= 99) return 'silver';
  return 'bronze';
}

export default function BlockBadge({
  blockHeight,
  rank,
  totalParticipants,
  isWinner,
  index = 0,
}: BlockBadgeProps) {
  const [hovered, setHovered] = useState(false);
  const formattedHeight = String(blockHeight);
  const tier = getTier(rank, isWinner);
  const colors = TIER_COLORS[tier];
  const gradientId = `medal-${blockHeight}`;
  const ringGradientId = `ring-${blockHeight}`;
  const glowId = `glow-${blockHeight}`;

  return (
    <motion.a
      href={`https://mempool.space/block/${blockHeight}`}
      target="_blank"
      rel="noopener noreferrer"
      className="relative inline-flex flex-col items-center no-underline"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      whileHover={{ scale: 1.15 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg viewBox="0 0 48 48" width={44} height={44}>
        <defs>
          {/* Medal face gradient */}
          <radialGradient id={gradientId} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor={colors.face[0]} />
            <stop offset="40%" stopColor={colors.face[1]} />
            <stop offset="75%" stopColor={colors.face[2]} />
            <stop offset="100%" stopColor={colors.face[3]} />
          </radialGradient>

          {/* Outer ring gradient */}
          <linearGradient id={ringGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.ring[0]} />
            <stop offset="50%" stopColor={colors.ring[1]} />
            <stop offset="100%" stopColor={colors.ring[2]} />
          </linearGradient>

          {/* Glow filter */}
          {colors.glow && (
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={colors.glowStrength} result="blur" />
              <feFlood floodColor={colors.glow} floodOpacity={colors.glowOpacity} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Outer metallic ring */}
        <circle
          cx="24" cy="24" r="22"
          fill={`url(#${ringGradientId})`}
          filter={colors.glow ? `url(#${glowId})` : undefined}
        />

        {/* Medal face */}
        <circle
          cx="24" cy="24" r="18.5"
          fill={`url(#${gradientId})`}
        />

        {/* Inner ring detail */}
        <circle
          cx="24" cy="24" r="16"
          fill="none"
          stroke={colors.innerStroke}
          strokeWidth={tier === 'gold' ? '0.75' : '0.5'}
          strokeOpacity={tier === 'gold' ? '0.7' : '0.5'}
        />

        {/* Crossed pickaxes — Stylized for better visibility at small scale */}
        <g opacity="0.8" transform="translate(24, 19)">
          {/* Left pickaxe */}
          <g transform="rotate(-35)">
            <rect
              x="-0.8" y="-9" width="1.6" height="15" rx="0.8"
              fill={colors.icon}
            />
            <path
              d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z"
              fill={colors.icon}
            />
          </g>
          {/* Right pickaxe */}
          <g transform="rotate(35)">
            <rect
              x="-0.8" y="-9" width="1.6" height="15" rx="0.8"
              fill={colors.icon}
            />
            <path
              d="M-7-10c2-2 5-2 7-2s5 0 7 2l-7 2z"
              fill={colors.icon}
            />
          </g>
        </g>

        {/* Block height text */}
        <text
          x="24" y="34"
          textAnchor="middle"
          fill={colors.text}
          fontSize="7.5"
          fontFamily="'Courier New', Courier, monospace"
          fontWeight="bold"
        >
          {formattedHeight}
        </text>
      </svg>

      {/* Tooltip on hover */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background border border-border rounded shadow-lg text-xs whitespace-nowrap z-20">
          Block {formattedHeight} — Rank #{rank}/{totalParticipants}
        </div>
      )}
    </motion.a>
  );
}
