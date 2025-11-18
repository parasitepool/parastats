'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

export default function AnimatedCounter({ 
  value, 
  duration = 2000
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [rollingDigits, setRollingDigits] = useState<Set<number>>(new Set());
  const prevValueRef = useRef(0);
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
      const startTime = Date.now();
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(value * easeOut);
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
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
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
            transform: translateY(0);
            opacity: 1;
          }
          25% { 
            transform: translateY(-30%);
            opacity: 0.3;
          }
          26% { 
            transform: translateY(30%);
            opacity: 0.3;
          }
          50% { 
            transform: translateY(0);
            opacity: 1;
          }
          75% { 
            transform: translateY(-15%);
            opacity: 0.6;
          }
          76% { 
            transform: translateY(15%);
            opacity: 0.6;
          }
          100% { 
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-digit-roll {
          animation: digit-roll 0.8s ease-in-out;
        }
      `}</style>
    </span>
  );
}
