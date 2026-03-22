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
    face: ['#FFF1A8', '#FFD700', '#DAA520', '#B8860B'],
    ring: ['#DAA520', '#8B6914', '#DAA520'],
    innerStroke: '#B8860B',
    icon: '#7A5C00',
    text: '#5A3E00',
    glow: '#FFD700',
  },
  silver: {
    face: ['#E8E8E8', '#C0C0C0', '#909090', '#606060'],
    ring: ['#808080', '#404040', '#808080'],
    innerStroke: '#505050',
    icon: '#1A1A1A',
    text: '#1A1A1A',
    glow: null,
  },
  bronze: {
    face: ['#E8C8A0', '#CD7F32', '#A0622E', '#7A4A1E'],
    ring: ['#A0622E', '#5C3310', '#A0622E'],
    innerStroke: '#7A4A1E',
    icon: '#4A2800',
    text: '#3A1E00',
    glow: null,
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

          {/* Glow filter (gold only) */}
          {colors.glow && (
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feFlood floodColor={colors.glow} floodOpacity="0.5" result="color" />
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
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />

        {/* Crossed pickaxes — Stylized for better visibility at small scale */}
        <g opacity="0.65" transform="translate(24, 19)">
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
          {tier === 'gold' && <span style={{ color: '#FFD700' }}> ★</span>}
        </div>
      )}
    </motion.a>
  );
}
