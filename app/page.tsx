"use client";

import { useEffect, useState } from "react";
import Leaderboard from "./components/tables/BoardDiff";
import PoolStats from "./components/PoolStats";
import RecentBlocks from "./components/RecentBlocks";
import HashrateGauge from "./components/HashrateGauge";
import RetroProgressBar from "./components/RetroProgressBar";
import LoyaltyBoard from "./components/tables/BoardLoyalty";
import UsersWorkersChart from "./components/UsersWorkersChart";
import HashrateTrends from "./components/HashrateTrends";
import HashrateChart from "./components/HashrateChart";
import BoardCombined from "./components/tables/BoardCombined";
import { getPoolStats, getHistoricalPoolStats, type PoolStats as PoolStatsType } from "./utils/api";
import type { HistoricalPoolStats } from "./api/pool-stats/historical/route";

export default function Dashboard() {
  const [poolStats, setPoolStats] = useState<PoolStatsType>();
  const [loading, setLoading] = useState(true);
  const [historicalStats, setHistoricalStats] = useState<HistoricalPoolStats[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const poolStatsData = await getPoolStats();
        setPoolStats(poolStatsData);
      } catch (error) {
        console.error("Error fetching pool stats:", error);
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
        const data = await getHistoricalPoolStats("9d", "5m");
        setHistoricalStats(data);
      } catch (error) {
        console.error("Error fetching historical stats:", error);
      } finally {
        setHistoricalLoading(false);
      }
    }

    fetchHistoricalData();

    // Refresh historical data every 5 minutes
    const intervalId = setInterval(fetchHistoricalData, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Format data for HashrateChart
  const hashrateChartData = {
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
    hashrates: historicalStats.map(entry => entry.hashrate15m),
  };

  // Format data for UsersWorkersChart
  const usersWorkersChartData = {
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
    users: historicalStats.map(entry => entry.users),
    workers: historicalStats.map(entry => entry.workers),
    idle: historicalStats.map(entry => entry.idle),
    disconnected: historicalStats.map(entry => entry.disconnected),
  };

  return (
    <main className="flex min-h-screen flex-col items-center pb-8">
      <div className="w-full mb-6">
        <RecentBlocks />
      </div>
      <div className="w-full mb-6">
        <PoolStats poolStats={poolStats} loading={loading} />
      </div>
      <div className="w-full mb-6">
        {/* <RetroProgressBarExample /> */}
        <RetroProgressBar
          current={(poolStats?.hashrate || 0) / 1000000000000000}
          max={1000}
          showLabel={true}
          label="Parasite Power"
          labelSize="md"
          units="%"
          height={40}
          onlyCurrent={true}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mb-6">
        <div className="lg:col-span-2">
          <UsersWorkersChart data={usersWorkersChartData} loading={historicalLoading} />
        </div>
        <BoardCombined />
      </div>
      {/* <div className="w-full mb-6">
        <OverviewChart />
      </div> */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mb-6">
        <HashrateGauge totalHashrate={(poolStats?.hashrate || 0) / 1000000000000000} />
        <div className="lg:col-span-2">
          <HashrateChart data={hashrateChartData} loading={historicalLoading} />
        </div>
        {/* <HashrateDistribution /> */}
      </div>
      <div className="w-full mb-6">
        <HashrateTrends />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mb-6">
        <Leaderboard />
        <LoyaltyBoard />
      </div>
    </main>
  );
}
