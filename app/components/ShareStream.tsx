'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { formatDifficulty } from '../utils/hashmath';
import { getWinnerDiffs } from '../utils/api';
import {
  buildRandomDelays,
  isWinnerShare,
  winnerSignature,
  WINNER_POLL_INTERVAL_MS,
  type WinnerShare,
} from '../utils/winners';

const PACKET_WIDTH_PX = 80;
const AVERAGE_CARD_GAP_PX = 50;
const MINIMUM_CARD_GAP_PX = 20;
const PIXELS_PER_SECOND = 20;
// Time it takes a card to travel its own width plus the minimum 20px gap.
const MIN_SLOT_GAP_MS = ((PACKET_WIDTH_PX + MINIMUM_CARD_GAP_PX) / PIXELS_PER_SECOND) * 1000;

interface ShareStreamProps {
  className?: string;
}

interface Slot {
  share: WinnerShare;
  delayMs: number;
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function ShareStream({ className = '' }: ShareStreamProps) {
  const [shares, setShares] = useState<WinnerShare[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [streamWidth, setStreamWidth] = useState<number | null>(null);
  const loadedSignatureRef = useRef<string | null>(null);
  const nextShareIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure the strip so the number of visible packets and their travel
  // distance are based on the available width.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => setStreamWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Follow the newest 24h winners. The full list is refreshed periodically;
  // when the 24h window changes the stream is re-seeded with the new set.
  useEffect(() => {
    let cancelled = false;

    async function loadWinners() {
      try {
        const recent = await getWinnerDiffs();
        if (cancelled) return;

        const winners = recent.filter(isWinnerShare);
        const signature = winnerSignature(winners);
        if (signature === loadedSignatureRef.current) return;

        loadedSignatureRef.current = signature;
        setBlockHeight(recent[0]?.block_height ?? null);

        if (winners.length === 0) {
          setShares([]);
          setSlots([]);
          return;
        }

        setShares(shuffle(winners));
      } catch (error) {
        console.error('Error loading share stream:', error);
      }
    }

    loadWinners();
    const intervalId = window.setInterval(loadWinners, WINNER_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const slotCount = streamWidth !== null
    ? Math.max(1, Math.floor(
        (streamWidth + PACKET_WIDTH_PX) / (PACKET_WIDTH_PX + AVERAGE_CARD_GAP_PX),
      ))
    : 0;
  const travelDistance = streamWidth !== null ? streamWidth + PACKET_WIDTH_PX : 0;
  const travelDurationMs = travelDistance > 0
    ? (travelDistance / PIXELS_PER_SECOND) * 1000
    : 0;

  // Fill the strip immediately with the first batch of winners. Each slot then
  // loops forever, taking the next winner when it re-enters from the left.
  useEffect(() => {
    if (shares.length === 0 || slotCount === 0 || travelDurationMs <= 0) return;

    const delays = buildRandomDelays(slotCount, travelDurationMs, MIN_SLOT_GAP_MS);
    setSlots(delays.map((delayMs, index) => ({
      share: shares[index % shares.length],
      delayMs,
    })));
    nextShareIndexRef.current = slotCount;
  }, [shares, slotCount, travelDurationMs]);

  const advanceSlot = (index: number) => {
    if (shares.length === 0) return;

    const nextShare = shares[nextShareIndexRef.current % shares.length];
    nextShareIndexRef.current += 1;

    setSlots((current) => {
      if (index >= current.length) return current;

      const next = [...current];
      next[index] = { ...next[index], share: nextShare };
      return next;
    });
  };

  return (
    <div className={`flex h-12 w-full gap-2 ${className}`}>
      <Link
        href="/winners"
        title="View 24h high difficulty shares"
        className="flex h-12 w-28 shrink-0 flex-col justify-center border border-foreground/20 bg-foreground/10 px-2 text-xs leading-tight text-gray-400 transition-colors hover:border-foreground/40"
      >
        <span className="font-bold">High Diff</span>
        <span>shares</span>
      </Link>
      <div
        ref={containerRef}
        className="relative h-12 min-w-0 flex-1 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
          '--share-travel': `${travelDistance}px`,
        } as CSSProperties}
      >
        {slots.map((slot, index) => {
          const difficulty = formatDifficulty(slot.share.difficulty);

          return (
            <Link
              key={`${blockHeight}-${shares.length}-${slotCount}-${index}`}
              href={`/winners?block=${slot.share.block_height}`}
              aria-label={`Block ${slot.share.block_height} winner ${slot.share.top_diff_address}, difficulty ${difficulty}`}
              title={`Block ${slot.share.block_height} — ${slot.share.top_diff_address} — ${difficulty}`}
              className="share-packet absolute right-full top-0 flex h-12 w-20 cursor-pointer flex-col items-center justify-between whitespace-nowrap border border-border/80 bg-background/95 px-1 py-1.5 text-center shadow-[0_0_10px_rgba(0,0,0,0.45)] hover:border-accent-1"
              style={{
                '--share-delay': `${-slot.delayMs}ms`,
                '--share-duration': `${travelDurationMs}ms`,
              } as CSSProperties}
              onAnimationIteration={() => advanceSlot(index)}
            >
              <span className="text-sm font-semibold leading-none text-foreground">
                {difficulty}
              </span>
              <span className="text-[10px] leading-none text-accent-3">{slot.share.top_diff_address}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
