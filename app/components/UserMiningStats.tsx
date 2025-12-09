'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ClockIcon, CalendarIcon, LightningIcon, CurrencyDollarIcon } from './icons';

interface UserMiningStatsProps {
  userHashrate: string; // In TH/s
  minerWattages: number[]; // Array of wattages for each miner
  electricityRate?: number; // Cost per kWh in dollars, optional with default
}

export default function UserMiningStats({ 
  userHashrate, 
  minerWattages,
  electricityRate: initialElectricityRate = 0.12 // Default electricity rate if not provided
}: UserMiningStatsProps) {
  // Use lazy initialization to load from localStorage without causing setState in effect
  const [electricityRate, setElectricityRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedRate = localStorage.getItem('electricityRate');
      if (savedRate) {
        const parsedRate = parseFloat(savedRate);
        if (!isNaN(parsedRate) && parsedRate > 0) {
          return parsedRate;
        }
      }
    }
    return initialElectricityRate;
  });
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(() => electricityRate.toString());
  
  // Current network difficulty - in a real app this would be fetched from an API
  const [networkDifficulty, setNetworkDifficulty] = useState<number>(72e12); // 72 trillion (example)
  const [isLoading, setIsLoading] = useState(true);
  
  // Input ref for focusing
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate total wattage from all miners
  const totalWattage = minerWattages.reduce((sum, wattage) => sum + wattage, 0);
  
  useEffect(() => {
    // Simulate API fetch for network difficulty
    const fetchNetworkData = async () => {
      try {
        // This would be replaced with actual API call
        // const response = await fetch('https://api.example.com/bitcoin/difficulty');
        // const data = await response.json();
        // setNetworkDifficulty(data.difficulty);
        
        // For now, we'll use a mock value
        setTimeout(() => {
          setNetworkDifficulty(72e12);
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error("Error fetching network difficulty:", error);
        setIsLoading(false);
      }
    };

    fetchNetworkData();
  }, []);

  // Helper function to format probability in a readable way
  const formatProbability = (probability: number): string => {
    if (probability >= 0.01) {
      // Show as percentage if >= 1%
      return `${(probability * 100).toFixed(2)}%`;
    } else {
      // Show as "1 in X" format for small probabilities
      const oneInX = Math.round(1 / probability);
      return `1 in ${oneInX.toLocaleString()}`;
    }
  };

  // Use useMemo to calculate mining statistics instead of useEffect with setState
  const miningStats = useMemo(() => {
    if (isLoading) {
      return {
        monthlyChance: "Calculating...",
        yearlyChance: "Calculating...",
        dailyCost: "Calculating...",
        monthlyCost: "Calculating..."
      };
    }
    
    // Parse hashrate (remove 'TH/s' and convert to number)
    const hashrateValue = parseFloat(userHashrate.replace(" TH/s", ""));
    
    // Calculate block finding probability
    // Formula: (user_hashrate / network_hashrate) * blocks_in_period
    // Network hashrate can be derived from difficulty
    
    // Simplified calculation (for demonstration)
    // In a real implementation, you'd use more precise calculations
    const networkHashrate = networkDifficulty * 2**32 / 600 / 1e12; // In TH/s
    
    // Monthly chance (assuming 144 blocks per day * 30 days)
    const blocksPerMonth = 144 * 30;
    const monthlyProbability = (hashrateValue / networkHashrate) * blocksPerMonth;
    
    // Yearly chance (assuming 144 blocks per day * 365 days)
    const blocksPerYear = 144 * 365;
    const yearlyProbability = (hashrateValue / networkHashrate) * blocksPerYear;
    
    // Calculate electricity costs
    // Daily cost: (wattage / 1000) * 24 hours * electricity rate
    const dailyKwh = (totalWattage / 1000) * 24;
    const dailyElectricityCost = dailyKwh * electricityRate;
    
    // Monthly cost (30 days)
    const monthlyElectricityCost = dailyElectricityCost * 30;
    
    return {
      monthlyChance: formatProbability(monthlyProbability),
      yearlyChance: formatProbability(yearlyProbability),
      dailyCost: `$${dailyElectricityCost.toFixed(2)}`,
      monthlyCost: `$${monthlyElectricityCost.toFixed(2)}`
    };
  }, [userHashrate, networkDifficulty, isLoading, electricityRate, totalWattage]);

  // Save the electricity rate to localStorage and update state
  const saveElectricityRate = (value: string) => {
    const parsedValue = parseFloat(value);
    
    // Only update if value is valid and actually changed
    if (!isNaN(parsedValue) && parsedValue > 0 && parsedValue !== electricityRate) {
      // Update state
      setElectricityRate(parsedValue);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('electricityRate', parsedValue.toString());
      }
    }
    
    setIsEditing(false);
  };
  
  // Handle the change of input value (just update the input value state)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle key press (specifically Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveElectricityRate(inputValue);
      e.currentTarget.blur(); // Remove focus
    }
  };
  
  // Handle blur event (clicking away)
  const handleBlur = () => {
    saveElectricityRate(inputValue);
  };
  
  // Start editing when clicking on the rate
  const handleEditClick = () => {
    setIsEditing(true);
    // Focus input after a brief delay to let the render complete
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
  };

  const statCards = [
    {
      title: '1 Month Block Chance',
      value: miningStats.monthlyChance,
      icon: <ClockIcon />
    },
    {
      title: '1 Year Block Chance',
      value: miningStats.yearlyChance,
      icon: <CalendarIcon />
    },
    {
      title: 'Daily Electricity Cost',
      value: miningStats.dailyCost,
      icon: <LightningIcon />
    },
    {
      title: 'Monthly Electricity Cost',
      value: miningStats.monthlyCost,
      icon: <CurrencyDollarIcon />
    },
  ];

  return (
    <div className="w-full mb-8">
      <div className="flex flex-wrap -mx-2">
        {statCards.map((card, index) => (
          <div key={index} className="w-1/2 md:w-1/4 p-1 lg:p-2">
            <div className="bg-background p-4 shadow-md border border-border h-full">
              <div className="flex items-center mb-2">
                <div className="mr-2 text-accent-3">
                  {card.icon}
                </div>
                <h3 className="text-sm font-medium text-accent-2">{card.title}</h3>
              </div>
              <p className="text-2xl font-semibold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
      {totalWattage > 0 && (
        <div className="flex items-center text-sm text-foreground/50 mt-2">
          <p>Based on {totalWattage.toLocaleString()}W total power consumption at </p>
          
          {isEditing ? (
            <div className="relative ml-1">
              <span className="absolute left-2 top-1">$</span>
              <input
                ref={inputRef}
                type="number"
                min="0.01"
                step="0.01"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="pl-5 w-24 h-6 border border-foreground focus:outline-none text-foreground bg-background"
              />
              <span className="ml-1">/kWh</span>
            </div>
          ) : (
            <button 
              onClick={handleEditClick}
              className="ml-1 text-foreground cursor-pointer hover:underline focus:outline-none"
            >
              ${electricityRate.toFixed(2)}/kWh
            </button>
          )}
        </div>
      )}
    </div>
  );
} 