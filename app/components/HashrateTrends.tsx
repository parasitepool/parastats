import React, { useState, useEffect } from "react";
import StatCard from "./StatCard";
import { formatHashrate } from "../utils/formatters";
import { getHistoricalPoolStats } from "../utils/api";

interface HashrateWithChange {
  value: number;
  change: number;
}

interface HashrateTrendsProps {
  oneDayAvg?: HashrateWithChange;
  sixDayAvg?: HashrateWithChange;
  nineDayAvg?: HashrateWithChange;
}

export default function HashrateTrends({
  oneDayAvg,
  sixDayAvg,
  nineDayAvg,
}: HashrateTrendsProps) {
  const [data, setData] = useState<{
    oneDayAvg: HashrateWithChange;
    sixDayAvg: HashrateWithChange;
    nineDayAvg: HashrateWithChange;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch 18 days of data with 1-hour intervals for better performance
        const historicalData = await getHistoricalPoolStats('18d', '1h');
        
        if (historicalData.length === 0) {
          setError('No data available');
          return;
        }
        
        // Sort data by timestamp, oldest first
        const sortedData = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate averages for different periods
        const now = Date.now() / 1000;
        const oneDayData = sortedData.filter(item => item.timestamp >= now - 24 * 60 * 60);
        const sixDayData = sortedData.filter(item => item.timestamp >= now - 6 * 24 * 60 * 60);
        const nineDayData = sortedData;
        
        // Calculate average hashrates
        const calculateAvg = (data: typeof sortedData) => {
          if (data.length === 0) return 0;
          return data.reduce((sum, item) => sum + item.hashrate15m, 0) / data.length;
        };
        
        const oneDayAvgValue = calculateAvg(oneDayData);
        const sixDayAvgValue = calculateAvg(sixDayData);
        const nineDayAvgValue = calculateAvg(nineDayData);
        
        // Calculate percentage changes
        // For 1-day, compare with previous day
        const prevDayData = sortedData.filter(
          item => item.timestamp >= now - 2 * 24 * 60 * 60 && item.timestamp < now - 24 * 60 * 60
        );
        const prevDayAvg = calculateAvg(prevDayData);
        const oneDayChange = prevDayAvg ? ((oneDayAvgValue - prevDayAvg) / prevDayAvg) * 100 : 0;
        
        // For 6-day, compare with previous 6 days
        const prev6DayData = sortedData.filter(
          item => item.timestamp >= now - 12 * 24 * 60 * 60 && item.timestamp < now - 6 * 24 * 60 * 60
        );
        const prev6DayAvg = calculateAvg(prev6DayData);
        const sixDayChange = prev6DayAvg ? ((sixDayAvgValue - prev6DayAvg) / prev6DayAvg) * 100 : 0;
        
        // For 9-day, compare with previous 9 days
        const prev9DayData = sortedData.filter(
          item => item.timestamp >= now - 18 * 24 * 60 * 60 && item.timestamp < now - 9 * 24 * 60 * 60
        );
        const prev9DayAvg = calculateAvg(prev9DayData);
        const nineDayChange = prev9DayAvg ? ((nineDayAvgValue - prev9DayAvg) / prev9DayAvg) * 100 : 0;
        
        setData({
          oneDayAvg: { value: oneDayAvgValue, change: oneDayChange },
          sixDayAvg: { value: sixDayAvgValue, change: sixDayChange },
          nineDayAvg: { value: nineDayAvgValue, change: nineDayChange },
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching hashrate trends:', err);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    // Refresh data every 15 minutes
    const intervalId = setInterval(fetchData, 15 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const formatChange = (change: number) => {
    const isPositive = change >= 0;

    return (
      <span className="ml-2 text-accent-2 flex items-baseline">
        <span className="text-sm mr-1">
          {isPositive ? "+" : ""}
          {change.toFixed(2)}%
        </span>
        {isPositive ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 ml-1 text-accent-3 self-center"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4 ml-1 text-accent-3 self-center"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414l4.293 4.293a1 1 0 00.707.293H12z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
    );
  };

  const renderStatCard = (title: string, data: HashrateWithChange) => {
    return (
      <StatCard
        title={title}
        value={
          <div className="flex items-baseline">
            <div>{formatHashrate(data.value)}</div>
            {formatChange(data.change)}
          </div>
        }
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
              clipRule="evenodd"
            />
          </svg>
        }
        loading={loading}
      />
    );
  };

  // Use provided data or calculated data
  const dataToUse = {
    oneDayAvg: oneDayAvg || (data?.oneDayAvg || { value: 0, change: 0 }),
    sixDayAvg: sixDayAvg || (data?.sixDayAvg || { value: 0, change: 0 }),
    nineDayAvg: nineDayAvg || (data?.nineDayAvg || { value: 0, change: 0 }),
  };

  return (
    <div className="w-full">
      {error && <p className="text-center text-red-500 mb-4">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderStatCard("1D Avg Hashrate", dataToUse.oneDayAvg)}
        {renderStatCard("6D Avg Hashrate", dataToUse.sixDayAvg)}
        {renderStatCard("9D Avg Hashrate", dataToUse.nineDayAvg)}
      </div>
    </div>
  );
}
