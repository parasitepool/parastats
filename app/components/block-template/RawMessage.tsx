"use client";

import { useState } from "react";
import { StratumNotification } from "../../api/stratum/route";

interface RawMessageProps {
  notification: StratumNotification;
}

export default function RawMessage({ notification }: RawMessageProps) {
  const [showRawMessage, setShowRawMessage] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const rawMessageStr = JSON.stringify(notification.raw, null, 2);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowRawMessage(!showRawMessage)}
        className="flex items-center gap-3 w-full p-4 bg-foreground/5 hover:bg-foreground/10 border border-border transition-colors text-left"
      >
        <svg 
          className={`w-5 h-5 text-accent-2 transition-transform ${showRawMessage ? 'rotate-90' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        
        <div className="flex-1">
          <div className="font-medium text-foreground">
            Raw Stratum Message
          </div>
          <div className="text-sm text-accent-2">
            {showRawMessage ? 'Click to collapse' : 'Click to expand'} • {rawMessageStr.length} characters
          </div>
        </div>
      </button>
      
      {showRawMessage && (
        <div className="bg-foreground/5 border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-accent-2">
              Complete Stratum Protocol Message
            </div>
            <button
              onClick={() => copyToClipboard(rawMessageStr)}
              className="text-sm px-3 py-1 bg-foreground/10 hover:bg-foreground/20 transition-colors text-accent-2 hover:text-foreground cursor-pointer"
            >
              Copy
            </button>
          </div>
          
          <div className="bg-foreground/10 p-4 overflow-x-auto">
            <pre className="font-mono text-sm text-foreground">
              {rawMessageStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
