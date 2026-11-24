'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { formatDifficulty } from '../utils/hashmath';
import {
  buildRandomDelays,
  isShadowBlockTopDiffShare,
  shadowBlockTopDiffSignature,
  type ShadowBlockTopDiff,
  type ShadowBlockTopDiffShare,
} from '../utils/shadow-block';

const PACKET_WIDTH_PX = 112;
const AVERAGE_CARD_GAP_PX = 120;
const MINIMUM_CARD_GAP_PX = 30;
const PIXELS_PER_SECOND = 90;
const MIN_SLOT_GAP_MS = ((PACKET_WIDTH_PX + MINIMUM_CARD_GAP_PX) / PIXELS_PER_SECOND) * 1000;

interface ShareStreamProps {
  diffs: ShadowBlockTopDiff[];
  className?: string;
}

interface Slot {
  share: ShadowBlockTopDiffShare;
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

export default function ShareStream({ diffs, className = '' }: ShareStreamProps) {
  const [shares, setShares] = useState<ShadowBlockTopDiffShare[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [streamWidth, setStreamWidth] = useState<number | null>(null);
  const loadedSignatureRef = useRef<string | null>(null);
  const nextShareIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => setStreamWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const topDiffs = diffs.filter(isShadowBlockTopDiffShare);
    const signature = shadowBlockTopDiffSignature(topDiffs);
    if (signature === loadedSignatureRef.current) return;

    loadedSignatureRef.current = signature;
    setBlockHeight(diffs[0]?.block_height ?? null);

    if (topDiffs.length === 0) {
      setShares([]);
      setSlots([]);
      return;
    }

    setShares(shuffle(topDiffs));
  }, [diffs]);

  const slotCount = streamWidth !== null
    ? Math.max(1, Math.floor(
        (streamWidth + PACKET_WIDTH_PX) / (PACKET_WIDTH_PX + AVERAGE_CARD_GAP_PX),
      ))
    : 0;
  const travelDistance = streamWidth !== null ? streamWidth + PACKET_WIDTH_PX : 0;
  const travelDurationMs = travelDistance > 0
    ? (travelDistance / PIXELS_PER_SECOND) * 1000
    : 0;

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
    <div
      ref={containerRef}
      className={`relative h-12 w-full min-w-0 overflow-hidden ${className}`}
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
            href={`/shadow-block?block=${slot.share.block_height}`}
            aria-label={`Block ${slot.share.block_height} top diff ${slot.share.top_diff_address}, difficulty ${difficulty}`}
            title={`Block ${slot.share.block_height} — ${slot.share.top_diff_address} — ${difficulty}`}
            className="share-packet absolute right-full top-0 flex h-12 w-28 cursor-pointer flex-col items-center justify-between whitespace-nowrap border border-border/80 bg-background/95 px-1.5 py-1.5 text-center shadow-[0_0_10px_rgba(0,0,0,0.45)] hover:border-accent-1"
            style={{
              '--share-delay': `${-slot.delayMs}ms`,
              '--share-duration': `${travelDurationMs}ms`,
            } as CSSProperties}
            onAnimationIteration={() => advanceSlot(index)}
          >
            <span className="text-sm font-semibold leading-none text-foreground">
              {difficulty}
            </span>
            <span className="max-w-full truncate text-[10px] leading-none text-accent-3">
              {slot.share.top_diff_address}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
