"use client";

import {useEffect, useState} from "react";
import {formatDifficulty, formatHashWork, formatPercent, parseHashrate} from "../utils/hashmath";
import {formatExpectedBlockTime, formatPrice} from "../utils/formatters";
import StatCard from "./StatCard";
import {getBitcoinPrice, getDifficultyAdjustment, type PoolStats as PoolStatsType} from "../utils/api";
import {Adjustment} from "@mempool/mempool.js/lib/interfaces/bitcoin/difficulty";
import {BookmarkIcon, InfoIcon, LightningIcon, PickaxeIcon, TrendingUpIcon, WalletIcon} from "./icons";

interface PoolStatsProps {
  poolStats?: PoolStatsType;
  loading: boolean;
  currentDifficulty?: number;
}

export default function PoolStats({ poolStats, loading, currentDifficulty }: PoolStatsProps) {
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);
  const [difficultyAdjustment, setDifficultyAdjustment] = useState<Adjustment>();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [adjustmentData, priceData] = await Promise.all([
          getDifficultyAdjustment(),
          getBitcoinPrice(),
        ]);
        
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
    if (!currentDifficulty || !difficultyAdjustment?.difficultyChange)
      return null;

    const changePercent = difficultyAdjustment.difficultyChange / 100;
    return currentDifficulty * (1 + changePercent);
  };

  const expectedDifficulty = calculateExpectedDifficulty();

  // Expected work for one block equals the current network difficulty. Work is
  // already tracked in difficulty-1 units, so the ratio is directly comparable.
  const workRatio =
    poolStats?.workSinceLastBlock && currentDifficulty
      ? poolStats.workSinceLastBlock / currentDifficulty
      : null;
  const expectedWorkPercent = workRatio !== null ? workRatio * 100 : null;

  const statCards = [
    {
      title: "Highest Diff Since Last Block",
      value: poolStats?.highestDifficulty && currentDifficulty ? (
        <div className="flex flex-col">
          {poolStats.highestDifficulty}
          <span
            className="text-sm text-muted-foreground cursor-help leading-none"
            title="Percentage of the current network difficulty"
          >
            ({formatPercent((parseHashrate(poolStats.highestDifficulty) / currentDifficulty) * 100)})
          </span>
        </div>
      ) : '-',
      icon: <TrendingUpIcon />,
    },
    {
      title: "Total Work Since Last Block",
      value: (
        <div className="flex flex-col">
          {formatHashWork(poolStats?.workSinceLastBlock ?? undefined)}
          {expectedWorkPercent !== null && (
            <span
              className="text-sm text-muted-foreground cursor-help leading-none"
              title="Work done as a percentage of the expected work for one block at the current network difficulty."
            >
              ({formatPercent(expectedWorkPercent)})
            </span>
          )}
        </div>
      ),
      icon: <PickaxeIcon />,
    },
    {
      title: "Minimum Needed Diff",
      value: (
        <div className="flex flex-col">
          {formatDifficulty(currentDifficulty)}
          {expectedDifficulty &&
            difficultyAdjustment?.difficultyChange !== undefined && (
              <span className="text-sm text-accent-2 flex items-center">
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
            )}
        </div>
      ),
      icon: <TrendingUpIcon />,
    },
    {
      title: "Avg to Find Block",
      value: formatExpectedBlockTime(poolStats?.hashrate, currentDifficulty),
      icon: <LightningIcon />,
    },
    {
      title: "Last Block Found",
      value: poolStats?.lastBlockTime && poolStats?.lastBlockHash
        ? <a href={`https://mempool.space/block/${poolStats.lastBlockHash}`} target="_blank" rel="noopener noreferrer">{poolStats.lastBlockTime}</a>
        : '-',
      icon: <BookmarkIcon />,
    },
    {
      title: "Bitcoin Price",
      value: formatPrice(bitcoinPrice),
      icon: <WalletIcon />,
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
        {statCards.map((card, index) => (
          <StatCard
            key={index}
            title={card.title}
            value={card.value}
            icon={card.icon}
            loading={loading || localLoading}
            compact
          />
        ))}
      </div>
    </div>
  );
}
