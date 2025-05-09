"use client";

import { useState, useEffect } from "react";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import Link from "next/link";
import Image from "next/image";

interface BlockCardProps {
  block: Block;
  newBlock: boolean;
  isCompact?: boolean;
}

export default function BlockCard({ block, newBlock, isCompact = true }: BlockCardProps) {
  const [timeString, setTimeString] = useState<string>("");

  // Format timestamp to readable date
  const formatTime = (timestamp: number) => {
    const now = new Date();
    const blockTime = new Date(timestamp * 1000);
    const diffInMinutes = Math.floor(
      (now.getTime() - blockTime.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hr ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  // Update time display
  useEffect(() => {
    // Set initial time
    setTimeString(formatTime(block.timestamp));

    // Set up timer to update time string every 5 seconds
    const timer = setInterval(() => {
      setTimeString(formatTime(block.timestamp));
    }, 5000);

    // Clean up timer on unmount
    return () => clearInterval(timer);
  }, [block.timestamp]);

  return (
    <Link
      href={`https://mempool.space/block/${block.id}`}
      className={`flex-shrink-0 border p-2 hover:bg-foreground/5 transition-all duration-300 ease-in-out snap-start ${
        isCompact ? 'w-28' : 'w-48'
      }`}
      style={{
        maxHeight: isCompact ? '85px' : '200px', 
        transition: 'max-height 0.3s ease-in-out, width 0.3s ease-in-out'
      }}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className={`${isCompact ? 'flex-col' : 'flex justify-between'} items-start mb-2`}>
        <div className={`font-bold ${newBlock ? 'animate-pulse' : ''}`}>{block.height}</div>
        <div className="text-xs text-accent-2">{timeString}</div>
      </div>

      {!isCompact && (
        <div className="border-t border-border pt-2 mb-2 transition-all duration-300 ease-in-out">
          <div className="flex items-center text-sm">
            <svg
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 8h10M7 12h10M7 16h10M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="truncate">{block.tx_count} txs</span>
          </div>

          <div className="flex items-center text-sm mt-1">
            <span className="inline-flex justify-center items-center h-4 w-4 mr-1">₿</span>
            <span className="truncate">
              ~{block.extras.medianFee.toFixed(1)} sat/vB
            </span>
          </div>
        </div>
      )}

      <div className={`${!isCompact ? 'border-t border-border pt-2 text-sm' : 'text-xs'} flex justify-between items-center transition-all duration-300 ease-in-out`}>
        <div className="truncate font-medium">
          {block.extras.pool.name || "Unknown"}
        </div>
        {!isCompact && (
          <div className="truncate font-medium">
            <Image 
              src={`/pool_images/${block.extras.pool.slug}.svg`} 
              alt={block.extras.pool.name || "Unknown"} 
              width={20} 
              height={20} 
              className="w-auto h-5" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/pool_images/default.svg";
              }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
