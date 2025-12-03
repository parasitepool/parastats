'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: bigint | number;
  duration?: number;
  maxAnimatedDigits?: number; // Maximum number of digits from the right to animate
  revealedDigits?: number; // Number of trailing digits to reveal (others cycle like slot machine)
}

// Generate a random digit 0-9
const randomDigit = () => Math.floor(Math.random() * 10).toString();

export default function AnimatedCounter({ 
  value, 
  duration = 2000,
  maxAnimatedDigits,
  revealedDigits
}: AnimatedCounterProps) {
  // Convert value to number for calculations
  const numValue = typeof value === 'bigint' ? Number(value) : value;

  // Dynamically determine how many digits to animate based on value magnitude
  const getMaxAnimatedDigits = (num: number): number => {
    if (maxAnimatedDigits !== undefined) {
      return maxAnimatedDigits; // Use provided value if specified
    }
    
    // Auto-determine based on magnitude
    if (num >= 1_000_000_000_000) { // Trillion or more
      return 9;
    } else if (num >= 1_000_000_000) { // Billion or more
      return 6;
    } else {
      return 3; // Default for smaller numbers
    }
  };

  const effectiveMaxDigits = getMaxAnimatedDigits(numValue);

  const [displayValue, setDisplayValue] = useState<bigint>(typeof value === 'bigint' ? value : BigInt(value));
  const [isAnimating, setIsAnimating] = useState(false);
  const [rollingDigits, setRollingDigits] = useState<Set<number>>(new Set());
  const [cyclingDigits, setCyclingDigits] = useState<Map<number, string>>(new Map());
  const prevValueRef = useRef<bigint>(typeof value === 'bigint' ? value : BigInt(value));
  const startValueRef = useRef<bigint>(typeof value === 'bigint' ? value : BigInt(value));
  const animationFrameRef = useRef<number | undefined>(undefined);
  const cycleIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isInitialMount = useRef(true);

  // Handle the slot machine cycling for hidden digits
  useEffect(() => {
    if (revealedDigits === undefined) return;

    const formattedValue = displayValue.toLocaleString();
    const chars = formattedValue.split('');
    
    // Count only actual digits (not commas) from the end
    let digitCount = 0;
    const revealedIndices = new Set<number>();
    
    for (let i = chars.length - 1; i >= 0 && digitCount < revealedDigits; i--) {
      if (chars[i] !== ',') {
        digitCount++;
      }
      revealedIndices.add(i);
    }

    // Find indices that should cycle (digits that aren't revealed)
    const hiddenDigitIndices: number[] = [];
    for (let i = 0; i < chars.length; i++) {
      if (!revealedIndices.has(i) && chars[i] !== ',') {
        hiddenDigitIndices.push(i);
      }
    }

    // Start cycling animation for hidden digits
    const cycle = () => {
      const newCycling = new Map<number, string>();
      for (const idx of hiddenDigitIndices) {
        newCycling.set(idx, randomDigit());
      }
      setCyclingDigits(newCycling);
    };

    // Initial cycle
    cycle();
    
    // Cycle every 80ms for smooth slot machine effect
    cycleIntervalRef.current = setInterval(cycle, 80);

    return () => {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
      }
    };
  }, [displayValue, revealedDigits]);

  useEffect(() => {
    // Convert value to bigint
    const targetValue = typeof value === 'bigint' ? value : BigInt(value);

    // On initial mount, animate from rounded value to actual value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      // Round down to nearest value based on magnitude
      const roundToNearest = (num: number): bigint => {
        if (num >= 1_000_000_000_000) { // Trillion+
          // Round to nearest billion (zero out last 9 digits)
          return BigInt(Math.floor(num / 1_000_000_000) * 1_000_000_000);
        } else if (num >= 1_000_000_000) { // Billion+
          // Round to nearest million (zero out last 6 digits)
          return BigInt(Math.floor(num / 1_000_000) * 1_000_000);
        } else {
          // Round to nearest thousand (zero out last 3 digits)
          return BigInt(Math.floor(num / 1_000) * 1_000);
        }
      };
      
      const startValue = roundToNearest(numValue);
      setDisplayValue(startValue);
      startValueRef.current = startValue;
      
      // Trigger animation
      setIsAnimating(true);
      
      // Shuffle all digits on first load
      const formattedValue = targetValue.toString();
      const digitIndices = new Set(Array.from({ length: formattedValue.length }, (_, i) => i));
      setRollingDigits(digitIndices);
      
      // Animate from rounded value to actual value
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const diff = Number(targetValue - startValue);
        const currentValue = startValue + BigInt(Math.floor(diff * easeOut));
        setDisplayValue(currentValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(targetValue);
          setIsAnimating(false);
          setRollingDigits(new Set());
          prevValueRef.current = targetValue;
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // On value changes, only animate changed digits
    if (prevValueRef.current === targetValue) {
      return;
    }

    const oldStr = prevValueRef.current.toString().padStart(targetValue.toString().length, '0');
    const newStr = targetValue.toString();
    
    // Find which digit positions changed
    const changedIndices = new Set<number>();
    for (let i = 0; i < newStr.length; i++) {
      if (oldStr[i] !== newStr[i]) {
        changedIndices.add(i);
      }
    }
    
    setRollingDigits(changedIndices);
    setIsAnimating(true);

    const startValue = prevValueRef.current;
    startValueRef.current = startValue;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const diff = Number(targetValue - startValue);
      const currentValue = startValue + BigInt(Math.floor(diff * easeOut));
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        setIsAnimating(false);
        setRollingDigits(new Set());
        prevValueRef.current = targetValue;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration, numValue]);

  // Format the display value
  const formattedValue = displayValue.toLocaleString();
  const chars = formattedValue.split('');

  // Calculate which indices are revealed (counting from the end, only digits)
  const revealedIndices = new Set<number>();
  if (revealedDigits !== undefined) {
    let digitCount = 0;
    for (let i = chars.length - 1; i >= 0 && digitCount < revealedDigits; i--) {
      if (chars[i] !== ',') {
        digitCount++;
      }
      revealedIndices.add(i);
    }
  }

  // Helper to determine if a character at index should show rolling animation
  const shouldShowRolling = (index: number): boolean => {
    if (!isAnimating) return false;
    
    const char = formattedValue[index];
    if (char === ',') return false; // Never animate commas
    
    // Get the start formatted value to compare (where animation began)
    const startFormatted = startValueRef.current.toLocaleString();
    
    // If the strings are different lengths, animate based on position from right
    if (startFormatted.length !== formattedValue.length) {
      let digitsFromRight = 0;
      for (let i = formattedValue.length - 1; i >= index; i--) {
        if (formattedValue[i] !== ',') {
          digitsFromRight++;
        }
      }
      return digitsFromRight <= effectiveMaxDigits;
    }
    
    // If same length, check if this specific position has changed from start
    const startChar = startFormatted[index];
    const currentChar = formattedValue[index];
    
    // This digit is changing from the start value
    return startChar !== currentChar;
  };

  return (
    <span className="inline-flex">
      {chars.map((char, index) => {
        const isRolling = shouldShowRolling(index);
        const isHidden = revealedDigits !== undefined && !revealedIndices.has(index) && char !== ',';
        const cycledChar = isHidden ? cyclingDigits.get(index) || char : char;
        
        return (
          <span
            key={index}
            className={`
              inline-block
              overflow-hidden
              relative
              ${isRolling ? 'animate-digit-roll' : ''}
              ${isHidden ? 'text-accent-3/70 animate-slot-reel' : ''}
            `}
            style={{
              minWidth: char === ',' ? '0.3em' : '0.6em',
              textAlign: 'center'
            }}
          >
            {isHidden ? cycledChar : char}
          </span>
        );
      })}
      <style jsx>{`
        @keyframes digit-roll {
          0% { 
            opacity: 1;
          }
          50% { 
            opacity: 0.5;
          }
          100% { 
            opacity: 1;
          }
        }
        .animate-digit-roll {
          animation: digit-roll 0.5s ease-in-out;
        }
        @keyframes slot-reel {
          0%, 100% {
            transform: translateY(0);
          }
          25% {
            transform: translateY(-2px);
          }
          75% {
            transform: translateY(2px);
          }
        }
        .animate-slot-reel {
          animation: slot-reel 0.15s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}