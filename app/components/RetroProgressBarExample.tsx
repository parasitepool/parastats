'use client';

import { useState, useEffect } from 'react';
import RetroProgressBar from './RetroProgressBar';

export default function RetroProgressBarExample() {
  const [progress1, setProgress1] = useState(25);
  const [progress2, setProgress2] = useState(70);
  const [progress3, setProgress3] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  // Simulate progress for the third bar
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        setProgress3(prev => prev < 100 ? prev + 1 : 0);
      }, 150);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Handle increment/decrement of the manual progress bars
  const handleAdjustProgress = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter(prev => {
      const newValue = prev + amount;
      return Math.min(100, Math.max(0, newValue));
    });
  };

  return (
    <div className="p-6 bg-background border border-border space-y-8">
      <h2 className="text-xl font-semibold mb-6">Retro Progress Bars</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg mb-2">Basic</h3>
          <RetroProgressBar current={progress1} max={100} />
          <div className="flex mt-2 space-x-2">
            <button 
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-xs font-mono"
              onClick={() => handleAdjustProgress(setProgress1, -10)}
            >
              [-10%]
            </button>
            <button 
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-xs font-mono"
              onClick={() => handleAdjustProgress(setProgress1, 10)}
            >
              [+10%]
            </button>
            <span className="ml-2 text-xs font-mono text-accent-1">Current: {progress1}%</span>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg mb-2">With Labels</h3>
          <RetroProgressBar 
            current={progress2} 
            max={100} 
            showLabel={true} 
            label="LOADING..." 
          />
          <div className="flex mt-2 space-x-2">
            <button 
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-xs font-mono"
              onClick={() => handleAdjustProgress(setProgress2, -5)}
            >
              [-5%]
            </button>
            <button 
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-xs font-mono"
              onClick={() => handleAdjustProgress(setProgress2, 5)}
            >
              [+5%]
            </button>
            <button 
              className="px-2 py-1 bg-secondary hover:bg-secondary-hover text-xs font-mono ml-2"
              onClick={() => setProgress2(0)}
            >
              [RESET]
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg mb-2">Animated Progress</h3>
          <RetroProgressBar 
            current={progress3} 
            max={100} 
            showLabel={true} 
            label="PROCESSING..." 
            height={40} 
          />
          <div className="flex mt-2 space-x-2">
            <button 
              className={`px-2 py-1 ${isRunning ? 'bg-accent-3' : 'bg-primary'} hover:bg-primary-hover text-xs font-mono`}
              onClick={() => setIsRunning(!isRunning)}
            >
              [{isRunning ? 'PAUSE' : 'RESUME'}]
            </button>
            <button 
              className="px-2 py-1 bg-secondary hover:bg-secondary-hover text-xs font-mono"
              onClick={() => {
                setProgress3(0);
                setIsRunning(true);
              }}
            >
              [RESTART]
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg mb-2">Different Sizes</h3>
          <div className="space-y-4">
            <RetroProgressBar current={35} max={100} height={15} />
            <RetroProgressBar current={50} max={100} height={25} />
            <RetroProgressBar current={75} max={100} height={50} />
          </div>
        </div>

        <div>
          <h3 className="text-lg mb-2">Fixed Width</h3>
          <div className="w-64 mb-4">
            <RetroProgressBar current={40} max={100} />
          </div>
          <div className="w-96 mb-4">
            <RetroProgressBar current={60} max={100} />
          </div>
          <div className="w-full md:w-1/2 lg:w-1/3">
            <RetroProgressBar current={100} max={100} />
          </div>
        </div>
      </div>
    </div>
  );
} 