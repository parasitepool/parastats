'use client';

import React, { useEffect, useState, useRef } from 'react';

interface VerboseUptimeProps {
  uptimeString: string; // e.g., "160d 20h"
  firstSeenTimestamp?: number; // Unix timestamp in seconds when miner first connected
  duration?: number;
}

interface UptimeValues {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function VerboseUptime({ 
  uptimeString,
  firstSeenTimestamp,
  duration = 2000 
}: VerboseUptimeProps) {
  const [displayValues, setDisplayValues] = useState<UptimeValues>({
    years: 0,
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [animatingFields, setAnimatingFields] = useState<Set<keyof UptimeValues>>(new Set());
  const prevValuesRef = useRef<UptimeValues>(displayValues);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const isInitialMount = useRef(true);
  const liveCounterIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const firstConnectionTimeRef = useRef<Date | null>(null);

  // Calculate uptime values from a timestamp
  const calculateUptimeFromTimestamp = (startTime: Date): UptimeValues => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    
    let totalSeconds = Math.floor(diffMs / 1000);
    
    const years = Math.floor(totalSeconds / (365 * 24 * 60 * 60));
    totalSeconds -= years * (365 * 24 * 60 * 60);
    
    const months = Math.floor(totalSeconds / (30 * 24 * 60 * 60));
    totalSeconds -= months * (30 * 24 * 60 * 60);
    
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    totalSeconds -= days * (24 * 60 * 60);
    
    const hours = Math.floor(totalSeconds / (60 * 60));
    totalSeconds -= hours * (60 * 60);
    
    const minutes = Math.floor(totalSeconds / 60);
    totalSeconds -= minutes * 60;
    
    const seconds = totalSeconds;
    
    return { years, months, days, hours, minutes, seconds };
  };

  // Live counter effect - recalculates from first connection time every second
  useEffect(() => {
    liveCounterIntervalRef.current = setInterval(() => {
      if (firstConnectionTimeRef.current) {
        setDisplayValues(calculateUptimeFromTimestamp(firstConnectionTimeRef.current));
      }
    }, 1000);

    return () => {
      if (liveCounterIntervalRef.current) {
        clearInterval(liveCounterIntervalRef.current);
      }
    };
  }, []);

  // Parse uptime string (e.g., "160d 20h" or "2h 15m")
  const parseUptimeString = (uptime: string): UptimeValues => {
    const result: UptimeValues = {
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };

    // Match patterns like "160d", "20h", "15m", "30s"
    const patterns = [
      { regex: /(\d+)y/i, key: 'years' as keyof UptimeValues },
      { regex: /(\d+)mo/i, key: 'months' as keyof UptimeValues },
      { regex: /(\d+)d/i, key: 'days' as keyof UptimeValues },
      { regex: /(\d+)h/i, key: 'hours' as keyof UptimeValues },
      { regex: /(\d+)m(?!o)/i, key: 'minutes' as keyof UptimeValues },
      { regex: /(\d+)s/i, key: 'seconds' as keyof UptimeValues }
    ];

    patterns.forEach(({ regex, key }) => {
      const match = uptime.match(regex);
      if (match) {
        result[key] = parseInt(match[1], 10);
      }
    });

    // Convert days to months and remaining days (30 days = 1 month)
    if (result.days >= 30) {
      result.months += Math.floor(result.days / 30);
      result.days = result.days % 30;
    }

    // Convert months to years and remaining months (12 months = 1 year)
    if (result.months >= 12) {
      result.years += Math.floor(result.months / 12);
      result.months = result.months % 12;
    }

    return result;
  };

  useEffect(() => {
    // If we have an exact timestamp, use it directly
    if (firstSeenTimestamp) {
      const firstConnectionTime = new Date(firstSeenTimestamp * 1000);
      firstConnectionTimeRef.current = firstConnectionTime;
      
      // Calculate current uptime from the timestamp
      const currentUptime = calculateUptimeFromTimestamp(firstConnectionTime);
      
      if (isInitialMount.current) {
        isInitialMount.current = false;
        setDisplayValues(currentUptime);
        prevValuesRef.current = currentUptime;
      } else {
        setDisplayValues(currentUptime);
        prevValuesRef.current = currentUptime;
      }
      return;
    }

    // Fallback: Calculate from uptime string if no timestamp provided
    const targetValues = parseUptimeString(uptimeString);

    // Calculate the first connection timestamp based on the uptime string
    const now = new Date();
    const totalSeconds = 
      targetValues.years * 365 * 24 * 60 * 60 +
      targetValues.months * 30 * 24 * 60 * 60 +
      targetValues.days * 24 * 60 * 60 +
      targetValues.hours * 60 * 60 +
      targetValues.minutes * 60 +
      targetValues.seconds;
    
    const firstConnectionTime = new Date(now.getTime() - (totalSeconds * 1000));
    
    // Store the first connection time
    firstConnectionTimeRef.current = firstConnectionTime;

    // On initial mount, set display values directly
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setDisplayValues(targetValues);
      prevValuesRef.current = targetValues;
      return;
    }

    // When uptimeString changes (e.g., from data refresh), recalculate the first connection time
    // The live counter will use this new timestamp
    setDisplayValues(targetValues);
    prevValuesRef.current = targetValues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uptimeString, firstSeenTimestamp ?? 0]); // Use ?? 0 to ensure array size is constant

  // Format a number to 2 digits with rolling animation
  const formatUnit = (value: number, unit: keyof UptimeValues, label: string) => {
    const formatted = value.toString().padStart(2, '0');
    const isAnimating = animatingFields.has(unit);
    
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex">
          {formatted.split('').map((digit, index) => (
            <span
              key={`${unit}-${index}`}
              className={`
                inline-block
                overflow-hidden
                relative
                ${isAnimating ? 'animate-digit-roll' : ''}
              `}
              style={{
                minWidth: '0.6em',
                textAlign: 'center'
              }}
            >
              {digit}
            </span>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    );
  };

  return (
    <>
      <style>
        {`
          @keyframes digit-roll {
            0% { 
              filter: blur(0px);
              opacity: 0.7;
            }
            50% {
              filter: blur(0.5px);
              opacity: 0.85;
            }
            100% { 
              filter: blur(0px);
              opacity: 1;
            }
          }
          .animate-digit-roll {
            animation: digit-roll 0.3s ease-in-out;
          }
        `}
      </style>
      <span className="flex items-center gap-2 font-mono text-sm">
        {formatUnit(displayValues.seconds, 'seconds', 's')}
        {formatUnit(displayValues.minutes, 'minutes', 'm')}
        {formatUnit(displayValues.hours, 'hours', 'h')}
        {formatUnit(displayValues.days, 'days', 'd')}
        {formatUnit(displayValues.months, 'months', 'mo')}
        {formatUnit(displayValues.years, 'years', 'y')}
      </span>
    </>
  );
}
