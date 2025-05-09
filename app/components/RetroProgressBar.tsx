'use client';

import { FC, useRef, useEffect, useState, useCallback } from 'react';

// Debounce helper function
const debounce = <T extends unknown[]>(func: (...args: T) => void, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

interface RetroProgressBarProps {
  current: number;
  max: number;
  showLabel?: boolean;
  units?: string;
  height?: number;
  className?: string;
  label?: string;
  labelSize?: 'xs' | 'sm' | 'md' | 'lg';
  onlyCurrent?: boolean;
}

const RetroProgressBar: FC<RetroProgressBarProps> = ({
  current,
  max,
  showLabel = false,
  units = '',
  height = 30,
  className = '',
  label = '',
  labelSize = 'xs',
  onlyCurrent = false,  
}) => {
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  
  // Container ref to measure width
  const containerRef = useRef<HTMLDivElement>(null);
  const [barCount, setBarCount] = useState<number>(0); // Default, will be updated

  // Update bar count based on container width (with debounce)
  const updateBarCount = useCallback(
    debounce(() => {
      if (containerRef.current) {
        // Each bar is 8px wide (w-2) + 2px margin (mx-px)
        // So each bar takes approximately 3px of space
        const width = containerRef.current.clientWidth;
        // Calculate how many bars can fit, accounting for the margins
        const estimatedBarCount = Math.floor(width / 8);
        setBarCount(estimatedBarCount > 0 ? estimatedBarCount : 50);
      }
    }, 100), 
    []
  );

  useEffect(() => {
    // Update initially
    updateBarCount();

    // Add resize listener
    window.addEventListener('resize', updateBarCount);
    
    return () => {
      window.removeEventListener('resize', updateBarCount);
    };
  }, [updateBarCount, height]);
  
  // Calculate filled bars based on percentage and total bar count
  const filledBars = percentage === 100 
    ? barCount // At 100%, fill all bars
    : Math.floor((percentage / 100) * barCount);
  
  // Generate bars
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    // Calculate brightness based on position
    // Bars will get lighter as they approach the right (100%)
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
      {(showLabel || label) && (
        <div className={`flex justify-between mb-1 text-${labelSize} text-foreground font-semibold`}>
          <span>{label || `${Math.round(percentage)}%`}</span>
          {showLabel && !onlyCurrent ? <span>{current} {units} / {max} {units}</span> : <span>{current}{units}</span>}
        </div>
      )}
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
      </div>
      {/* Display percentage and current value below */}
      {showLabel && !onlyCurrent && (
        <div className="flex justify-end mt-1">
          <span className="text-xs text-muted">[{Math.round(percentage)}%]</span>
        </div>
      )}
    </div>
  );
};

export default RetroProgressBar; 