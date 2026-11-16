"use client";

import { useState, useEffect } from "react";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import Link from "next/link";

interface BlockCardProps {
  block: Block;
}

export default function BlockCard({ block }: BlockCardProps) {
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

  // Use lazy initialization to avoid setState in effect
  const [timeString, setTimeString] = useState<string>(() => formatTime(block.timestamp));

  // Update time display
  useEffect(() => {
    // Set up timer to update time string every 5 seconds
    const timer = setInterval(() => {
      setTimeString(formatTime(block.timestamp));
    }, 5000);

    // Clean up timer on unmount
    return () => clearInterval(timer);
  }, [block.timestamp]);

  const avgFeeRate = typeof block.extras?.avgFeeRate === "number"
    ? block.extras.avgFeeRate
    : typeof block.extras?.medianFee === "number"
      ? block.extras.medianFee
      : null;

  return (
    <Link
      href={`https://mempool.space/block/${block.id}`}
      className="flex-shrink-0 w-28 h-24 overflow-hidden border p-2 hover:bg-foreground/5 transition-colors snap-start flex flex-col"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="font-bold leading-none">{block.height}</div>

      <div className="flex flex-1 flex-col justify-between pt-1 text-xs leading-none">
        <div className="truncate" title="Average fee rate">
          {avgFeeRate !== null ? `~${avgFeeRate.toFixed(1)} sat/vB` : '-'}
        </div>
        <div className="text-accent-2">{timeString}</div>
        <div className="truncate font-medium">
          {block.extras?.pool?.name || "Unknown"}
        </div>
      </div>
    </Link>
  );
}
