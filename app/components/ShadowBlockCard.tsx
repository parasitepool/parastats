"use client";

import { formatDifficulty, formatAddress } from "../utils/formatters";
import { type BlockWinner } from "../utils/api";
import Image from "next/image";

interface ShadowBlockCardProps {
  blockHeight: number;
  highestDiff?: BlockWinner;
  isCompact?: boolean;
  isPending?: boolean;
}

export default function ShadowBlockCard({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  blockHeight, 
  highestDiff, 
  isCompact = true,
  isPending = false 
}: ShadowBlockCardProps) {
  // If pending block, show a placeholder
  if (isPending) {
    return (
      <div
        className={`flex-shrink-0 border border-dashed border-accent-1/30 bg-accent-1/5 p-2 snap-start ${
          isCompact ? 'w-28' : 'w-48'
        }`}
        style={{
          transition: 'width 0.3s ease-in-out'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-xs text-accent-1/50 animate-pulse">Mining...</div>
          </div>
        </div>
      </div>
    );
  }

  // If no highest diff data, show empty state
  if (!highestDiff) {
    return (
      <div
        className={`flex-shrink-0 border border-dashed border-foreground/10 bg-foreground/5 p-2 snap-start ${
          isCompact ? 'w-28' : 'w-48'
        }`}
        style={{
          transition: 'width 0.3s ease-in-out'
        }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-xs text-foreground/30">No data</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 border border-accent-1/40 bg-accent-1/10 p-2 snap-start hover:bg-accent-1/15 transition-all duration-300 ease-in-out ${
        isCompact ? 'w-28' : 'w-48'
      }`}
      style={{
        transition: 'width 0.3s ease-in-out'
      }}
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
          <Image 
            src="/bug.png" 
            alt="Parasite" 
            width={14} 
            height={14} 
            className="mt-1"
            style={{
              filter: 'sepia(1) saturate(10) hue-rotate(-15deg) brightness(0.7)'
            }}
          />
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
            <div className="flex justify-center mt-2">
              <Image 
                src="/bug.png" 
                alt="Parasite" 
                width={20} 
                height={20} 
                style={{
                  filter: 'sepia(1) saturate(10) hue-rotate(-15deg) brightness(0.7)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

