'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  maxAnimatedDigits?: number; // Maximum number of digits from the right to animate
}

export default function AnimatedCounter({ 
  value, 
  duration = 2000,
  maxAnimatedDigits
}: AnimatedCounterProps) {
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

  const effectiveMaxDigits = getMaxAnimatedDigits(value);

  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);
  const startValueRef = useRef(value); // Track where animation started from
  const animationFrameRef = useRef<number | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // On initial mount, animate from rounded value to actual value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      // Round down to nearest value based on magnitude
      const roundToNearest = (num: number): number => {
        if (num >= 1_000_000_000_000) { // Trillion+
          // Round to nearest billion (zero out last 9 digits)
          return Math.floor(num / 1_000_000_000) * 1_000_000_000;
        } else if (num >= 1_000_000_000) { // Billion+
          // Round to nearest million (zero out last 6 digits)
          return Math.floor(num / 1_000_000) * 1_000_000;
        } else {
          // Round to nearest thousand (zero out last 3 digits)
          return Math.floor(num / 1_000) * 1_000;
        }
      };
      
      const startValue = roundToNearest(value);
      setDisplayValue(startValue);
      startValueRef.current = startValue; // Track start value for comparison
      
      // Trigger animation
      setIsAnimating(true);
      
      // Animate from rounded value to actual value
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (value - startValue) * easeOut);
        setDisplayValue(currentValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
          setIsAnimating(false);
          prevValueRef.current = value;
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // On value changes, animate from old to new
    if (prevValueRef.current === value) {
      return;
    }

    setIsAnimating(true);

    const startValue = prevValueRef.current;
    startValueRef.current = startValue; // Track start value for comparison
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        prevValueRef.current = endValue;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  // Format the display value
  const formattedValue = displayValue.toLocaleString();
  const chars = formattedValue.split('');

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
    <span className="flex">
      {chars.map((char, index) => {
        const isRolling = shouldShowRolling(index);
        
        return (
          <span
            key={index}
            className={`
              inline-block
              overflow-hidden
              relative
              ${isRolling ? 'animate-digit-roll' : ''}
            `}
            style={{
              minWidth: char === ',' ? '0.3em' : '0.6em',
              textAlign: 'center'
            }}
          >
            {char}
          </span>
        );
      })}
      <style jsx>{`
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
      `}</style>
    </span>
  );
}
