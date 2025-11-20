"use client";

import { useEffect, useState } from "react";
import {
  formatDifficulty,
  formatPrice,
  formatExpectedBlockTime,
  parseHashrate
} from "../utils/formatters";
import StatCard from "./StatCard";
import { 
  getHashrate, 
  getDifficultyAdjustment, 
  getBitcoinPrice,
  type PoolStats as PoolStatsType
} from "../utils/api";
import { Hashrate, Adjustment } from "@mempool/mempool.js/lib/interfaces/bitcoin/difficulty";
import { 
  ClockIcon, 
  LightningIcon, 
  BookmarkIcon, 
  TrendingUpIcon, 
  WalletIcon,
  InfoIcon 
} from "./icons";

interface PoolStatsProps {
  poolStats?: PoolStatsType;
  loading: boolean;
}

export default function PoolStats({ poolStats, loading }: PoolStatsProps) {
  const [hashrate, setHashrate] = useState<Hashrate>();
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [difficultyAdjustment, setDifficultyAdjustment] = useState<Adjustment>();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [highestDiffTooltipVisible, setHighestDiffTooltipVisible] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [hashrateData, adjustmentData, priceData] = await Promise.all([
          getHashrate(),
          getDifficultyAdjustment(),
          getBitcoinPrice(),
        ]);
        
        setHashrate(hashrateData);
        setDifficultyAdjustment(adjustmentData);
        setBitcoinPrice(priceData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLocalLoading(false);
      }
    }

    fetchData();

    // Set up interval to refresh data every 20 seconds
    const intervalId = setInterval(fetchData, 20000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  // Calculate expected difficulty at next adjustment
  const calculateExpectedDifficulty = () => {
    if (!hashrate?.currentDifficulty || !difficultyAdjustment?.difficultyChange)
      return null;

    const currentDiff = hashrate.currentDifficulty;
    const changePercent = difficultyAdjustment.difficultyChange / 100;
    const expectedDiff = currentDiff * (1 + changePercent);

    return expectedDiff;
  };

  const expectedDifficulty = calculateExpectedDifficulty();

  const statCards = [
    {
      title: "Pool's Highest Diff",
      value: poolStats?.highestDifficulty && hashrate?.currentDifficulty ? (
        <span className='flex gap-1'>
          {poolStats.highestDifficulty}
          <span 
            className="relative inline-block"
            onMouseEnter={() => setHighestDiffTooltipVisible(true)}
            onMouseLeave={() => setHighestDiffTooltipVisible(false)}
          >
            <span className="text-sm text-muted-foreground cursor-help">
              ({Number(((parseHashrate(poolStats.highestDifficulty) / hashrate.currentDifficulty) * 100).toFixed(2))}%)
            </span>
            {highestDiffTooltipVisible && (
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 w-48 p-2 bg-background border border-border rounded shadow-lg text-xs z-10">
                Percentage of the current network difficulty
              </span>
            )}
          </span>
        </span>
      ) : '-',
      icon: <TrendingUpIcon />,
    },
    {
      title: "Minimum Needed Diff",
      value: (
        <div className="flex items-baseline">
          {formatDifficulty(hashrate?.currentDifficulty)}
          {expectedDifficulty &&
            difficultyAdjustment?.difficultyChange !== undefined && (
              <span className="text-sm">
                <span className="ml-1 text-accent-2 flex items-center">
                  → {formatDifficulty(expectedDifficulty)}
                  <span 
                    className="relative inline-block ml-1 cursor-help"
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                  >
                    <InfoIcon className="h-4 w-4 text-accent-3 p-0.5" />
                    {tooltipVisible && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 w-48 p-2 bg-background border border-border rounded shadow-lg text-xs z-10">
                        Expected difficulty at next adjustment based on current hashrate
                      </div>
                    )}
                  </span>
                </span>
              </span>
            )}
        </div>
      ),
      icon: <TrendingUpIcon />,
    },
    {
      title: "Avg to Find Block",
      value: formatExpectedBlockTime(poolStats?.hashrate, hashrate?.currentDifficulty),
      icon: <LightningIcon />,
    },
    {
      title: "Last Block Found",
      value: poolStats?.lastBlockTime,
      icon: <BookmarkIcon />,
    },
    {
      title: "Pool Uptime",
      value: poolStats?.uptime,
      icon: <ClockIcon />,
    },
    {
      title: "Bitcoin Price",
      value: formatPrice(bitcoinPrice),
      icon: <WalletIcon />,
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap -mx-2">
        {statCards.map((card, index) => (
          <div key={index} className="w-1/2 md:w-1/3 lg:w-1/6 p-1 lg:p-2">
            <StatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              loading={loading || localLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
