"use client";

import Link from "next/link";
import { formatDifficulty, formatAddress } from "../utils/formatters";
import { type BlockWinner } from "../utils/api";

interface ShadowBlockCardProps {
  blockHeight: number;
  highestDiff?: BlockWinner;
  isCompact?: boolean;
}

export default function ShadowBlockCard({ 
  blockHeight, 
  highestDiff, 
  isCompact = true
}: ShadowBlockCardProps) {
  // If no highest diff data, show loading shimmer
  if (!highestDiff) {
    return (
      <div
        className={`flex-shrink-0 border border-dashed border-foreground/10 bg-foreground/5 p-2 snap-start transition-[width] duration-300 ease-in-out ${
          isCompact ? 'w-28' : 'w-48'
        }`}
        title={`Block #${blockHeight} - Loading...`}
      >
        <div className="flex flex-col items-center justify-center gap-1.5">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12"></div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/block/${blockHeight}`}
      className={`flex-shrink-0 border border-accent-1/40 bg-accent-1/10 p-2 snap-start hover:bg-accent-1/20 hover:border-accent-1/60 transition-all duration-300 ease-in-out cursor-pointer ${
        isCompact ? 'w-28' : 'w-48'
      }`}
      title={`Block #${blockHeight} - Best diff: ${formatDifficulty(highestDiff.difficulty)} - Click for leaderboard`}
    >
      {/* Compact view */}
      {isCompact ? (
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-accent-1">
            {formatDifficulty(highestDiff.difficulty)}
          </span>
          <div className="text-[10px] text-foreground/50 truncate max-w-full mt-0.5">
            {formatAddress(highestDiff.fullAddress)}
          </div>
        </div>
      ) : (
        /* Expanded view */
        <div>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-medium text-accent-1">Parasite</span>
          </div>
          <div className="border-t border-accent-1/20 pt-1">
            <div className="text-sm font-bold text-accent-1">
              {formatDifficulty(highestDiff.difficulty)}
            </div>
            <div className="text-xs text-foreground/60 truncate mt-0.5" title={highestDiff.fullAddress}>
              {formatAddress(highestDiff.fullAddress)}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}

