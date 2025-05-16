'use client';

import { useEffect } from 'react';

interface DifficultyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DifficultyInfoModal({ isOpen, onClose }: DifficultyInfoModalProps) {
  // Close modal on escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-1">Understanding Bitcoin Difficulty</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4 text-foreground/80 mb-6">
          <p>
            Bitcoin difficulty is a measure of how hard it is to mine a Bitcoin block. The current difficulty 
            number represents how many hashes (attempts) on average are required to find a valid block.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6">How Difficulty Works</h3>
          <p>
            The difficulty adjusts every 2,016 blocks (approximately every 2 weeks) to maintain Bitcoin&apos;s 
            10-minute average block time. If blocks are being mined too quickly, the difficulty increases; 
            if too slowly, it decreases.
          </p>

          <h3 className="text-lg font-semibold text-foreground mt-6">Understanding the Numbers</h3>
          <p>
            Difficulty numbers use the following suffixes for readability:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>K</strong> = Thousand (1,000) - from <em>Kilo</em></li>
            <li><strong>M</strong> = Million (1,000,000) - from <em>Mega</em></li>
            <li><strong>G</strong> = Billion (1,000,000,000) - from <em>Giga</em></li>
            <li><strong>T</strong> = Trillion (1,000,000,000,000) - from <em>Tera</em></li>
            <li><strong>P</strong> = Quadrillion (1,000,000,000,000,000) - from <em>Peta</em></li>
            <li><strong>E</strong> = Quintillion (1,000,000,000,000,000,000) - from <em>Exa</em></li>
          </ul>
          
          <p className="mt-4">
            For example:
            <br />• 1.23K = 1,230
            <br />• 45.6M = 45,600,000
            <br />• 789T = 789,000,000,000,000
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
