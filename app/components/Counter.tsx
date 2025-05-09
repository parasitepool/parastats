import React from 'react';

interface CounterProps {
  value: number;
  label?: string;
}

export default function Counter({ value, label = 'PPP' }: CounterProps) {
  // Format number to always have 9 digits with leading zeros
  const formattedValue = value.toString().padStart(9, '0');
  
  return (
    <div className="flex flex-col items-center text-xs xl:text-sm">
      {label && <span className="font-bold text-foreground mr-2">{label}</span>}
      <div className="flex border border-foreground/50 overflow-hidden">
        {formattedValue.split('').map((digit, index) => (
          <div 
            key={index} 
            className="w-4 xl:w-6 h-5 xl:h-6 flex items-center justify-center bg-background text-foreground font-bold border-r border-foreground/50 last:border-r-0"
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}
