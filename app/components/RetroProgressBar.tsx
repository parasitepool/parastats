'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface RetroProgressBarProps {
  current: number;
  max: number;
  height?: number;
  className?: string;
  label?: string;
  labelTooltip?: string;
  formatValue: (value: number) => string;
}

export default function RetroProgressBar({
  current,
  max,
  height = 30,
  className = '',
  label = '',
  labelTooltip,
  formatValue,
}: RetroProgressBarProps) {
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const labelText = label || `${Math.round(percentage)}%`;
  const tooltipId = useId();

  // Container ref to measure width
  const containerRef = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState<number>(0);

  const updateBarCount = useCallback(() => {
    // Each bar is 8px wide (w-2) plus margins, so estimate from the width.
    const width = containerRef.current?.clientWidth ?? 0;
    const estimatedBarCount = Math.floor(width / 8);
    setBarCount(estimatedBarCount > 0 ? estimatedBarCount : 50);
  }, []);

  useEffect(() => {
    updateBarCount();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateBarCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateBarCount]);

  // Calculate filled bars based on percentage and total bar count
  const filledBars = percentage === 100
    ? barCount // At 100%, fill all bars
    : Math.floor((percentage / 100) * barCount);

  // Generate bars
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    // Bars get lighter as they approach the right (100%)
    const brightness = i < filledBars
      ? 0.2 + (0.8 * (i / barCount))
      : 0.1;

    const backgroundColor = `rgba(237, 237, 237, ${brightness})`;

    // Check if this is the last filled bar
    const isLastFilledBar = i === filledBars - 1 && filledBars > 0 && filledBars < barCount;

    bars.push(
      <div
        key={i}
        className={`w-2 h-full mx-px ${isLastFilledBar ? 'retro-pulse' : ''}`}
        style={{
          backgroundColor: i < filledBars ? backgroundColor : 'rgba(68, 68, 68, 0.3)',
          boxShadow: i < filledBars ? `0 0 2px rgba(237, 237, 237, ${brightness * 0.8})` : 'none'
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col w-full ${className}`}>
      <div className="relative">
        <div
          ref={containerRef}
          className="flex items-center bg-secondary w-full border border-border overflow-hidden"
          style={{ height: `${height}px` }}
        >
          {bars}
        </div>
        {/* Scanline effect - subtle horizontal lines */}
        <div
          className="absolute top-0 left-0 w-full pointer-events-none"
          style={{
            height: `${height}px`,
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px)',
            opacity: 0.5
          }}
        />
        {/* CRT glow effect */}
        <div
          className="absolute top-0 left-0 w-full pointer-events-none"
          style={{
            height: `${height}px`,
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
            opacity: 0.7
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2">
          <span
            className={`group pointer-events-auto relative inline-flex h-6 items-center justify-center whitespace-nowrap bg-background/90 px-1.5 text-sm font-semibold leading-none text-foreground shadow-[0_0_8px_rgba(0,0,0,0.65)]${labelTooltip ? ' cursor-help' : ''}`}
            tabIndex={labelTooltip ? 0 : undefined}
            aria-describedby={labelTooltip ? tooltipId : undefined}
          >
            {labelText}
            {labelTooltip && (
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 w-64 -translate-y-2 whitespace-normal break-words rounded border border-border bg-background p-2 text-left text-xs font-normal leading-snug text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {labelTooltip}
              </span>
            )}
          </span>
          <span className="inline-flex h-6 items-center justify-center whitespace-nowrap bg-background/90 px-1.5 text-sm font-semibold leading-none text-foreground shadow-[0_0_8px_rgba(0,0,0,0.65)]">
            {formatValue(current)}
          </span>
        </div>
      </div>
    </div>
  );
}
