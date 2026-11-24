"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import BlockCard from "./BlockCard";
import ShadowBlockCard from "./ShadowBlockCard";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import {
  getBlocksTipHeight,
  getRecentBlocks,
  getRecentBlockTopDiffs,
  getRecommendedFees,
} from "../utils/api";
import { type ShadowBlockTopDiff } from "../utils/shadow-block";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import Link from "next/link";

const ShareStream = dynamic(() => import("./ShareStream"), {
  ssr: false,
  loading: () => (
    <div className="mt-2 h-12 w-full animate-pulse border border-border bg-secondary/40" />
  ),
});

type StripMode = "shadow" | "stream";

const STRIP_MODE_STORAGE_KEY = "recentBlocksStripMode";
const TOP_DIFF_LIMIT = 30;
const TOP_DIFF_POLL_INTERVAL_MS = 15_000;

function parseStripMode(value: string | null): StripMode {
  return value === "stream" ? "stream" : "shadow";
}

function MiningCard({ nextHeight, feeRate }: { nextHeight: number | null; feeRate: number | null }) {
  return (
    <Link
      href="/template"
      title="View current block template"
      className="flex-shrink-0 w-28 h-24 border border-dashed border-gray-500/50 p-2 animate-pulse-soft flex flex-col"
    >
      <div className="font-bold text-gray-400 leading-none">{nextHeight ?? "..."}</div>
      <div className="flex flex-1 flex-col justify-between pt-1 text-xs leading-none text-gray-400">
        <div title="Current recommended fee rate">
          {feeRate !== null ? `~${feeRate.toFixed(1)} sat/vB` : "-"}
        </div>
        <div>In ~10 min</div>
        <div>Mining...</div>
      </div>
    </Link>
  );
}

function StripModeToggle({ mode, onToggle }: { mode: StripMode; onToggle: () => void }) {
  const isStream = mode === "stream";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isStream ? "Switch to Shadow Blocks" : "Switch to Share Stream"}
      className="flex h-12 w-28 shrink-0 cursor-pointer flex-col justify-center border border-foreground/20 bg-foreground/10 px-1.5 text-left leading-tight text-gray-400 transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      <span className="whitespace-nowrap text-[11px] font-bold">
        {isStream ? "Share Stream" : "Shadow Blocks"}
      </span>
      <span className="mt-0.5 whitespace-nowrap text-[10px] text-foreground/50">
        {isStream ? "⇄ Shadow" : "⇄ Stream"}
      </span>
    </button>
  );
}

export default function RecentBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTipHeight, setCurrentTipHeight] = useState<number>(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [recentTopDiffs, setRecentTopDiffs] = useState<ShadowBlockTopDiff[]>([]);
  const [stripMode, setStripMode] = useState<StripMode>("shadow");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousTipHeightRef = useRef(0);
  const topDiffRequestRef = useRef<Promise<ShadowBlockTopDiff[]> | null>(null);

  useEffect(() => {
    try {
      setStripMode(parseStripMode(window.localStorage.getItem(STRIP_MODE_STORAGE_KEY)));
    } catch {
    }
  }, []);

  const toggleStripMode = useCallback(() => {
    setStripMode((current) => {
      const next: StripMode = current === "shadow" ? "stream" : "shadow";
      try {
        window.localStorage.setItem(STRIP_MODE_STORAGE_KEY, next);
      } catch {
      }
      return next;
    });
  }, []);

  const updateArrows = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftArrow(container.scrollLeft > 20);

      const hasMoreToScroll =
        container.scrollLeft <
        container.scrollWidth - container.clientWidth - 10;
      setShowRightArrow(hasMoreToScroll);
    }
  }, []);

  useEffect(() => {
    async function fetchBlocks() {
      try {
        setLoading(true);
        const blocksTipHeight = await getBlocksTipHeight();

        if (blocksTipHeight !== currentTipHeight) {
          setCurrentTipHeight(blocksTipHeight);
          const recentBlocks = await getRecentBlocks(blocksTipHeight);
          setBlocks(recentBlocks);
        }
      } catch (error) {
        console.error("Error fetching blocks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBlocks();
    const intervalId = setInterval(fetchBlocks, 10000);
    return () => clearInterval(intervalId);
  }, [currentTipHeight]);

  useEffect(() => {
    async function fetchFeeRate() {
      try {
        const recommendedFees = await getRecommendedFees();
        setFeeRate(recommendedFees.halfHourFee);
      } catch (error) {
        console.error("Error fetching recommended fee rate:", error);
      }
    }

    fetchFeeRate();
    const intervalId = setInterval(fetchFeeRate, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchHighestDiffs = useCallback(async (isCancelled?: () => boolean) => {
    const request =
      topDiffRequestRef.current ??
      (topDiffRequestRef.current = getRecentBlockTopDiffs(TOP_DIFF_LIMIT).finally(() => {
        topDiffRequestRef.current = null;
      }));

    try {
      const topDiffs = await request;
      if (!isCancelled?.()) {
        setRecentTopDiffs(topDiffs);
      }
    } catch (error) {
      console.error("Error fetching highest diffs:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      await fetchHighestDiffs(() => cancelled);
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, TOP_DIFF_POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [fetchHighestDiffs]);

  useEffect(() => {
    const previous = previousTipHeightRef.current;
    previousTipHeightRef.current = currentTipHeight;
    if (previous === 0 || currentTipHeight === previous) return;

    let cancelled = false;
    fetchHighestDiffs(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [currentTipHeight, fetchHighestDiffs]);

  const highestDiffs = useMemo(() => {
    const map = new Map<number, ShadowBlockTopDiff>();
    for (const diff of recentTopDiffs) {
      map.set(diff.block_height, diff);
    }
    return map;
  }, [recentTopDiffs]);

  useEffect(() => {
    if (blocks.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      updateArrows();
    }
  }, [blocks, updateArrows]);

  useEffect(() => {
    if (blocks.length > 0) {
      updateArrows();
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener("scroll", updateArrows);
        return () =>
          scrollContainer.removeEventListener("scroll", updateArrows);
      }
    }
  }, [blocks, updateArrows]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 300;
      const targetPosition =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: targetPosition,
        behavior: "smooth",
      });
    }
  };

  const nextBlockHeight = currentTipHeight > 0 ? currentTipHeight + 1 : null;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="flex w-28 shrink-0 flex-col gap-2">
          <MiningCard nextHeight={nextBlockHeight} feeRate={feeRate} />
          <StripModeToggle mode={stripMode} onToggle={toggleStripMode} />
        </div>

        <div className="relative min-w-0 flex-1">
          {blocks.length > 0 ? (
            <>
              {showLeftArrow && (
                <button
                  onClick={() => scroll("left")}
                  className="absolute left-0 top-12 -translate-y-1/2 z-10 bg-background/80 p-2 shadow-md hover:bg-background"
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon />
                </button>
              )}

              <div
                ref={scrollContainerRef}
                className="overflow-x-auto snap-x scrollbar-none"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <div className="flex gap-2">
                  {blocks.map((block) => (
                    <BlockCard
                      key={block.id || block.height || block.timestamp}
                      block={block}
                    />
                  ))}
                </div>

                {stripMode === "shadow" && (
                  <div className="mt-2 flex gap-2">
                    {blocks.map((block) => (
                      <ShadowBlockCard
                        key={`shadow-${block.height}`}
                        blockHeight={block.height}
                        highestDiff={highestDiffs.get(block.height)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {stripMode === "stream" && (
                <ShareStream diffs={recentTopDiffs} className="mt-2" />
              )}

              {showRightArrow && (
                <button
                  onClick={() => scroll("right")}
                  className="absolute right-0 top-12 -translate-y-1/2 z-10 bg-background/80 p-2 shadow-md hover:bg-background"
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex h-24 items-center justify-center border border-border text-accent-2">
                {loading ? "Loading block data..." : "No block data available"}
              </div>

              {stripMode === "stream" ? (
                <ShareStream diffs={recentTopDiffs} className="mt-2" />
              ) : (
                <div className={`mt-2 h-12 border border-border bg-secondary/40 ${loading ? "animate-pulse" : ""}`} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
