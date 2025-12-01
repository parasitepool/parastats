'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: bigint;
  duration?: number;
  revealedDigits?: number; // Number of trailing digits to reveal (others cycle like slot machine)
}

// Generate a random digit 0-9
const randomDigit = () => Math.floor(Math.random() * 10).toString();

export default function AnimatedCounter({ 
  value, 
  duration = 2000,
  revealedDigits
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<bigint>(BigInt(0));
  const [rollingDigits, setRollingDigits] = useState<Set<number>>(new Set());
  const [cyclingDigits, setCyclingDigits] = useState<Map<number, string>>(new Map());
  const prevValueRef = useRef<bigint>(BigInt(0));
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
    // On initial mount, show shuffling effect
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      // Shuffle all digits on first load
      const formattedValue = value.toString();
      const digitIndices = new Set(Array.from({ length: formattedValue.length }, (_, i) => i));
      setRollingDigits(digitIndices);
      
      // Animate from 0 to actual value
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = BigInt(Math.floor(Number(value) * easeOut));
        setDisplayValue(currentValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
          setRollingDigits(new Set());
          prevValueRef.current = value;
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // On value changes, only animate changed digits
    if (prevValueRef.current === value) {
      return;
    }

    const oldStr = prevValueRef.current.toString().padStart(value.toString().length, '0');
    const newStr = value.toString();
    
    // Find which digit positions changed
    const changedIndices = new Set<number>();
    for (let i = 0; i < newStr.length; i++) {
      if (oldStr[i] !== newStr[i]) {
        changedIndices.add(i);
      }
    }
    
    setRollingDigits(changedIndices);

    const startValue = prevValueRef.current;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const diff = Number(endValue - startValue);
      const currentValue = startValue + BigInt(Math.floor(diff * easeOut));
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setRollingDigits(new Set());
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
    // Also mark commas within the revealed section as revealed
    let foundFirstRevealed = false;
    for (let i = chars.length - 1; i >= 0; i--) {
      if (revealedIndices.has(i)) {
        foundFirstRevealed = true;
      } else if (foundFirstRevealed && chars[i] === ',') {
        // This comma is between revealed digits, keep it revealed
        // Actually, we want commas after the hidden section to be revealed too
      }
    }
  }

  return (
    <span className="inline-flex">
      {chars.map((char, index) => {
        const isRolling = rollingDigits.has(index);
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
