"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import BlockCard from "./BlockCard";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import { getBlocksTipHeight, getRecentBlocks, getRecommendedFees } from "../utils/api";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import Link from "next/link";

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

export default function RecentBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTipHeight, setCurrentTipHeight] = useState<number>(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

        // Only update if the tip height has changed
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

    // Initial fetch
    fetchBlocks();

    // Set up interval to check for new blocks every 10 seconds
    const intervalId = setInterval(fetchBlocks, 10000);

    // Clean up interval on component unmount
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

  // Separate useEffect for scrolling to handle new blocks
  useEffect(() => {
    if (blocks.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      updateArrows();
    }
  }, [blocks, updateArrows]);

  // Update arrows visibility when blocks data changes
  useEffect(() => {
    if (blocks.length > 0) {
      updateArrows();
      // Add scroll event listener
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener("scroll", updateArrows);
        return () =>
          scrollContainer.removeEventListener("scroll", updateArrows);
      }
    }
  }, [blocks, updateArrows]);

  // Function to scroll left or right
  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 300; // Adjust as needed
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
    <div className="w-full relative">
      {blocks.length > 0 ? (
        <>
          {showLeftArrow && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 p-2 shadow-md hover:bg-background"
              aria-label="Scroll left"
            >
              <ChevronLeftIcon />
            </button>
          )}

          <div className="flex gap-2">
            <MiningCard nextHeight={nextBlockHeight} feeRate={feeRate} />

            <div
              ref={scrollContainerRef}
              className="overflow-x-auto snap-x scrollbar-none flex-1 min-w-0"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <div className="flex space-x-2">
                {blocks.map((block) => (
                  <BlockCard
                    key={block.id || block.height || block.timestamp}
                    block={block}
                  />
                ))}
              </div>
            </div>
          </div>

          {showRightArrow && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 p-2 shadow-md hover:bg-background"
              aria-label="Scroll right"
            >
              <ChevronRightIcon />
            </button>
          )}
        </>
      ) : (
        <div className="flex gap-2">
          <MiningCard nextHeight={nextBlockHeight} feeRate={feeRate} />
          <div className="flex-1 min-w-0 py-10 text-center text-accent-2 border border-border">
            {loading ? "Loading block data..." : "No block data available"}
          </div>
        </div>
      )}
    </div>
  );
}
