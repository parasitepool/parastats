"use client";

import { useEffect, useState, useMemo } from "react";
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
import { useChartZoomData } from "./hooks/useChartZoomData";

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

  const {
    activeData: hashrateActiveData,
    isRefetching: isHashrateRefetching,
    onZoomChange: onHashrateZoomChange,
  } = useChartZoomData(historicalStats);
  const {
    activeData: usersActiveData,
    isRefetching: isUsersRefetching,
    onZoomChange: onUsersZoomChange,
  } = useChartZoomData(historicalStats);

  const hashrateChartData = useMemo(() => {
    if (hashrateActiveData.length === 0) {
      return { timestamps: [], series: [{ data: [], title: "1H Average" }] };
    }
    return {
      timestamps: hashrateActiveData.map(entry => {
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
          data: hashrateActiveData.map(entry => entry.hashrate1hr ?? 0),
          title: "1H Average"
        },
        {
          data: hashrateActiveData.map(entry => entry.hashrate1d ?? 0),
          title: "1D Average",
          lineStyle: "dashed" as const
        },
        {
          data: hashrateActiveData.map(entry => entry.hashrate7d ?? 0),
          title: "7D Average",
          lineStyle: "dotted" as const
        }
      ]
    };
  }, [hashrateActiveData]);

  const usersWorkersChartData = useMemo(() => {
    if (usersActiveData.length === 0) {
      return { dates: [], users: [], workers: [], idle: [], disconnected: [] };
    }
    return {
      dates: usersActiveData.map(entry => {
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
      users: usersActiveData.map(entry => entry.users ?? 0),
      workers: usersActiveData.map(entry => entry.workers ?? 0),
      idle: usersActiveData.map(entry => entry.idle ?? 0),
      disconnected: usersActiveData.map(entry => entry.disconnected ?? 0),
    };
  }, [usersActiveData]);

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
          current={(poolStats?.hashrate || 0) / 10000000000000000}
          max={100}
          showLabel={true}
          label="Parasite Power"
          labelSize="md"
          units="%"
          height={40}
          onlyCurrent={true}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-6">
        <HashrateGauge totalHashrate={(poolStats?.hashrate || 0) / 1000000000000000} />
        <div className="lg:col-span-2">
          <HashrateChart data={hashrateChartData} loading={historicalLoading} onZoomChange={onHashrateZoomChange} refetching={isHashrateRefetching} />
        </div>
        {/* <HashrateDistribution /> */}
      </div>
      <div className="w-full mb-6">
        <HashrateTrends historicalData={historicalStats} loading={historicalLoading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full mb-6">
        <div className="lg:col-span-2">
          <UsersWorkersChart data={usersWorkersChartData} loading={historicalLoading} onZoomChange={onUsersZoomChange} refetching={isUsersRefetching} />
        </div>
        <BoardCombined />
      </div>
      {/* <div className="w-full mb-6">
        <OverviewChart />
      </div> */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full mb-6">
        <Leaderboard />
        <LoyaltyBoard />
      </div>
    </main>
  );
}
