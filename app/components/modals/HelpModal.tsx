'use client';

import { useEffect } from 'react';
import MinerSetupGuide from '../MinerSetupGuide';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-background border border-foreground p-6 max-w-3xl w-full shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold text-accent-1">Miner Setup Guide</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mb-5">
          <div className="mb-6">
            <MinerSetupGuide />
          </div>
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