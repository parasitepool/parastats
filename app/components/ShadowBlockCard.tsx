"use client";

import Link from "next/link";
import { formatDifficulty } from "../utils/hashmath";
import { isShadowBlockTopDiffShare, type ShadowBlockTopDiff } from "../utils/shadow-block";

interface ShadowBlockCardProps {
  blockHeight: number;
  highestDiff?: ShadowBlockTopDiff;
}

export default function ShadowBlockCard({
  blockHeight,
  highestDiff,
}: ShadowBlockCardProps) {
  if (!highestDiff) {
    return (
      <div
        className="flex h-12 w-28 shrink-0 snap-start flex-col items-center justify-between border border-dashed border-border/60 bg-background/60 px-1.5 py-1.5"
        title={`Block #${blockHeight} - Loading...`}
      >
        <div className="h-3.5 w-12 animate-pulse bg-foreground/15" />
        <div className="h-2.5 w-16 animate-pulse bg-foreground/10" />
      </div>
    );
  }

  if (!isShadowBlockTopDiffShare(highestDiff)) {
    return (
      <Link
        href={`/block/${blockHeight}`}
        className="flex h-12 w-28 shrink-0 snap-start cursor-pointer flex-col items-center justify-between whitespace-nowrap border border-border/60 bg-background/80 px-1.5 py-1.5 text-center transition-colors hover:border-accent-1"
        title={`Block #${blockHeight} - No public top diff`}
      >
        <span className="text-sm font-semibold leading-none text-accent-3">—</span>
        <span className="max-w-full truncate text-[10px] leading-none text-accent-3">
          No public diff
        </span>
      </Link>
    );
  }

  const difficulty = formatDifficulty(highestDiff.difficulty);

  return (
    <Link
      href={`/block/${blockHeight}`}
      className="flex h-12 w-28 shrink-0 snap-start cursor-pointer flex-col items-center justify-between whitespace-nowrap border border-border/80 bg-background/95 px-1.5 py-1.5 text-center shadow-[0_0_10px_rgba(0,0,0,0.45)] transition-colors hover:border-accent-1"
      title={`Block #${blockHeight} - Best diff: ${difficulty} - Click for leaderboard`}
    >
      <span className="text-sm font-semibold leading-none text-foreground">
        {difficulty}
      </span>
      <span className="max-w-full truncate text-[10px] leading-none text-accent-3">
        {highestDiff.top_diff_address}
      </span>
    </Link>
  );
}
