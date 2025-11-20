"use client";

import { useState, useEffect, useRef } from "react";
import BlockCard from "./BlockCard";
import { Block } from "@mempool/mempool.js/lib/interfaces/bitcoin/blocks";
import { getPreference, setPreference } from "../../lib/localStorage";
import { getBlocksTipHeight, getRecentBlocks } from "../utils/api";
import { PlusIcon, MinusIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";
import Link from "next/link";

// Component for the pending block card
function PendingBlockCard({ nextHeight, isCompact }: { nextHeight: number; isCompact: boolean }) {
  return (
    <Link
      href="/template"
      className={`flex-shrink-0 border border-dashed border-gray-500/50 p-2 snap-start animate-pulse-soft ${
        isCompact ? 'w-28' : 'w-48'
      }`}
      style={{
        maxHeight: isCompact ? '85px' : '200px', 
        transition: 'max-height 0.3s ease-in-out, width 0.3s ease-in-out',
      }}
    >
      <div className={`${isCompact ? 'flex-col' : 'flex justify-between'} items-start mb-2`}>
        <div className="font-bold text-gray-400">{nextHeight}</div>
        <div className="text-xs text-gray-400">Pending</div>
      </div>

      {!isCompact && (
        <div className="border-t border-gray-500/30 pt-2 mb-2 transition-all duration-300 ease-in-out">
          <div className="flex items-center text-sm text-gray-400">
            <svg
              className="h-4 w-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2v10l7 3.5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7.5L12 12V2z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.3"
              />
            </svg>
            <span className="truncate">Template</span>
          </div>

          <div className="flex items-center text-sm mt-1 text-gray-400">
            <span className="inline-flex justify-center items-center h-4 w-4 mr-1">⚡</span>
            <span className="truncate">
              In progress
            </span>
          </div>
        </div>
      )}

      <div className={`${!isCompact ? 'border-t border-gray-500/30 pt-2 text-sm' : 'text-xs'} flex justify-between items-center transition-all duration-300 ease-in-out`}>
        <div className="truncate font-medium text-gray-400">
          {/* Parasite */}
        </div>
        {!isCompact && (
          <div className="truncate font-medium">
            <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
            </div>
          </div>
        )}
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
  const [isCompact, setIsCompact] = useState(true);
  const initialBlockHeightRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load isCompact preference from localStorage on initial render
  useEffect(() => {
    // Use optional chaining to safely access localStorage (to handle SSR)
    if (typeof window !== 'undefined') {
      const savedIsCompact = getPreference('isCompact');
      setIsCompact(savedIsCompact);
    }
  }, []);

  // Update localStorage when isCompact changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPreference('isCompact', isCompact);
    }
  }, [isCompact]);

  useEffect(() => {
    async function fetchBlocks() {
      try {
        setLoading(true);
        const blocksTipHeight = await getBlocksTipHeight();

        if (initialBlockHeightRef.current === 0) {
          initialBlockHeightRef.current = blocksTipHeight;
        }

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

  // Separate useEffect for scrolling to handle new blocks
  useEffect(() => {
    if (blocks.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      updateArrows();
    }
  }, [blocks]);

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
  }, [blocks]);

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

  // Function to update arrow visibility based on scroll position
  const updateArrows = () => {
    const container = scrollContainerRef.current;
    if (container) {
      // Show left arrow if scrolled away from the left edge
      setShowLeftArrow(container.scrollLeft > 20);

      // Show right arrow if there's more content to scroll right
      const hasMoreToScroll =
        container.scrollLeft <
        container.scrollWidth - container.clientWidth - 10;
      setShowRightArrow(hasMoreToScroll);
    }
  };

  const nextBlockHeight = currentTipHeight + 1;

  return (
    <div className="w-full relative">
      <div className="mb-2 flex justify-between items-center">
        <div></div>
        <button
          onClick={() => setIsCompact(!isCompact)}
          className="text-accent-2 hover:text-primary flex items-center gap-1 transition-all duration-300 ease-in-out"
          aria-label={isCompact ? "Expand view" : "Compact view"}
        >
            <span className="text-sm">{isCompact ? "Expand" : "Compact"}</span>
          {isCompact ? <PlusIcon /> : <MinusIcon />}
        </button>
      </div>

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

          <div
            ref={scrollContainerRef}
            className={`flex overflow-x-auto ${isCompact ? 'space-x-2' : 'space-x-4'} snap-x scrollbar-none px-2 transition-all duration-300 ease-in-out`}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Pending block card at the beginning */}
            <PendingBlockCard nextHeight={nextBlockHeight} isCompact={isCompact} />
            
            {blocks.map((block) => (
              <BlockCard
                key={block.id || block.height || block.timestamp}
                block={block}
                newBlock={block.height > initialBlockHeightRef.current}
                isCompact={isCompact}
              />
            ))}
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
        <div className="w-full py-10 text-center text-accent-2 border border-border">
          {loading ? "Loading block data..." : "No block data available"}
        </div>
      )}
    </div>
  );
}
