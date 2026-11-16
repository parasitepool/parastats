"use client";

import { useEffect, useState, useMemo } from "react";
import Leaderboard from "./components/tables/BoardDiff";
import PoolStats from "./components/PoolStats";
import RecentBlocks from "./components/RecentBlocks";
import HashrateGauge from "./components/HashrateGauge";
import RetroProgressBar from "./components/RetroProgressBar";
import ParasiteEffortBar from "./components/ParasiteEffortBar";
import ShareStream from "./components/ShareStream";
import { formatPercent } from "./utils/hashmath";
import LoyaltyBoard from "./components/tables/BoardLoyalty";
import UsersWorkersChart from "./components/UsersWorkersChart";
import HashrateTrends from "./components/HashrateTrends";
import HashrateChart from "./components/HashrateChart";
import BoardCombined from "./components/tables/BoardCombined";
import { getHashrate, getPoolStats, getHistoricalPoolStats, type PoolStats as PoolStatsType } from "./utils/api";
import type { HistoricalPoolStats } from "./api/pool-stats/historical/route";

export default function Dashboard() {
  const [poolStats, setPoolStats] = useState<PoolStatsType>();
  const [currentDifficulty, setCurrentDifficulty] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [historicalStats, setHistoricalStats] = useState<HistoricalPoolStats[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [poolStatsResult, hashrateResult] = await Promise.allSettled([
          getPoolStats(),
          getHashrate(),
        ]);

        if (poolStatsResult.status === "fulfilled") {
          setPoolStats(poolStatsResult.value);
        } else {
          console.error("Error fetching pool stats:", poolStatsResult.reason);
        }

        if (hashrateResult.status === "fulfilled") {
          setCurrentDifficulty(hashrateResult.value.currentDifficulty);
        } else {
          console.error("Error fetching network difficulty:", hashrateResult.reason);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Set up interval to refresh data every 20 seconds
    const intervalId = setInterval(fetchData, 20000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        setHistoricalLoading(true);
        const data = await getHistoricalPoolStats("30d", "30m");
        setHistoricalStats(data);
      } catch (error) {
        console.error("Error fetching historical stats:", error);
        // Set historicalStats to empty array on error to prevent undefined access
        setHistoricalStats([]);
      } finally {
        setHistoricalLoading(false);
      }
    }

    fetchHistoricalData();

    // Refresh historical data every 5 minutes
    const intervalId = setInterval(fetchHistoricalData, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Format data for HashrateChart only if we have valid historical stats
  const hashrateChartData = useMemo(() => {
    if (historicalStats.length === 0) {
      return { timestamps: [], series: [{ data: [], title: "1H Average" }] };
    }
    return {
      timestamps: historicalStats.map(entry => {
        const date = new Date(entry.timestamp * 1000);
        return date.toLocaleString("en-US", {
          year: undefined,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }),
      series: [
        {
          data: historicalStats.map(entry => entry.hashrate1hr ?? 0),
          title: "1H Average"
        },
        {
          data: historicalStats.map(entry => entry.hashrate1d ?? 0),
          title: "1D Average",
          lineStyle: "dashed" as const
        },
        {
          data: historicalStats.map(entry => entry.hashrate7d ?? 0),
          title: "7D Average",
          lineStyle: "dotted" as const
        }
      ]
    };
  }, [historicalStats]);

  // Format data for UsersWorkersChart only if we have valid historical stats
  const usersWorkersChartData = useMemo(() => {
    if (historicalStats.length === 0) {
      return { dates: [], users: [], workers: [], idle: [], disconnected: [] };
    }
    return {
      dates: historicalStats.map(entry => {
        const date = new Date(entry.timestamp * 1000);
        return date.toLocaleString("en-US", {
          year: undefined,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }),
      users: historicalStats.map(entry => entry.users ?? 0),
      workers: historicalStats.map(entry => entry.workers ?? 0),
      idle: historicalStats.map(entry => entry.idle ?? 0),
      disconnected: historicalStats.map(entry => entry.disconnected ?? 0),
    };
  }, [historicalStats]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-3 pb-8">
      <div className="w-full">
        <RecentBlocks />
        <ShareStream className="mt-2" />
      </div>
      <PoolStats
        poolStats={poolStats}
        loading={loading}
        currentDifficulty={currentDifficulty}
      />
      <div className="w-full space-y-3">
        {/* <RetroProgressBarExample /> */}
        <RetroProgressBar
          current={(poolStats?.hashrate || 0) / 1e17}
          max={100}
          label="Parasite Power"
          formatValue={formatPercent}
          height={40}
        />
        <ParasiteEffortBar
          workSinceLastBlock={poolStats?.workSinceLastBlock ?? null}
          currentDifficulty={currentDifficulty}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 w-full">
        <HashrateGauge hashrate={poolStats?.hashrate || 0} />
        <div className="lg:col-span-2">
          <HashrateChart data={hashrateChartData} loading={historicalLoading} />
        </div>
        {/* <HashrateDistribution /> */}
      </div>
      <div className="w-full">
        <HashrateTrends historicalData={historicalStats} loading={historicalLoading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 w-full">
        <div className="lg:col-span-2">
          <UsersWorkersChart data={usersWorkersChartData} loading={historicalLoading} />
        </div>
        <BoardCombined />
      </div>
      {/* <div className="w-full mb-6">
        <OverviewChart />
      </div> */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 w-full">
        <Leaderboard />
        <LoyaltyBoard />
      </div>
    </main>
  );
}
