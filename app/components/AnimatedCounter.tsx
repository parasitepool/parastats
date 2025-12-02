'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: bigint | number;
  duration?: number;
}

export default function AnimatedCounter({ 
  value, 
  duration = 2000
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<bigint>(BigInt(0));
  const [rollingDigits, setRollingDigits] = useState<Set<number>>(new Set());
  const prevValueRef = useRef<bigint>(BigInt(0));
  const animationFrameRef = useRef<number | undefined>(undefined);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // On initial mount, show shuffling effect
    if (isInitialMount.current) {
      isInitialMount.current = false;
      
      // Shuffle all digits on first load
      const formattedValue = value.toString();
      const digitIndices = new Set(Array.from({ length: formattedValue.length }, (_, i) => i));
      setRollingDigits(digitIndices);
      
      // Animate from 0 to actual value
      const targetValue = BigInt(value);
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = BigInt(Math.floor(Number(targetValue) * easeOut));
        setDisplayValue(currentValue);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(targetValue);
          setRollingDigits(new Set());
          prevValueRef.current = targetValue;
        }
      };
      
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // On value changes, only animate changed digits
    const valueBigInt = BigInt(value);
    if (prevValueRef.current === valueBigInt) {
      return;
    }

    const oldStr = prevValueRef.current.toString().padStart(valueBigInt.toString().length, '0');
    const newStr = valueBigInt.toString();
    
    // Find which digit positions changed
    const changedIndices = new Set<number>();
    for (let i = 0; i < newStr.length; i++) {
      if (oldStr[i] !== newStr[i]) {
        changedIndices.add(i);
      }
    }
    
    setRollingDigits(changedIndices);

    const startValue = BigInt(prevValueRef.current);
    const endValue = valueBigInt;
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

  return (
    <span className="inline-flex">
      {chars.map((char, index) => {
        const isRolling = rollingDigits.has(index);
        
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
      `}</style>
    </span>
  );
}
