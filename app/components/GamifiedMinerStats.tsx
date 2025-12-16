'use client';

import React, { useEffect, useState } from 'react';

interface GamifiedMinerStatsProps {
  authorisedTimestamp: number; // Unix timestamp when miner started
  totalShares: number;
  currentHashrate: number; // In TH/s
  lastSubmission: number; // Unix timestamp of last share
}

interface UptimeDisplay {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface LevelInfo {
  currentLevel: number;
  sharesInLevel: number;
  sharesForNextLevel: number;
  progressPercent: number;
}

interface StreakInfo {
  days: number;
  nextBadgeDays: number;
  progressPercent: number;
  badgeName: string;
}

export default function GamifiedMinerStats({
  authorisedTimestamp,
  totalShares,
  currentHashrate,
  lastSubmission
}: GamifiedMinerStatsProps) {
  const [uptime, setUptime] = useState<UptimeDisplay>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [timeToNextShare, setTimeToNextShare] = useState(0);

  // Calculate uptime every second
  useEffect(() => {
    const updateUptime = () => {
      const now = Math.floor(Date.now() / 1000);
      const uptimeSeconds = now - authorisedTimestamp;
      
      const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
      const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
      const seconds = uptimeSeconds % 60;
      
      setUptime({ days, hours, minutes, seconds });
    };

    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [authorisedTimestamp]);

  // Calculate time until next expected share
  useEffect(() => {
    const updateNextShare = () => {
      const now = Math.floor(Date.now() / 1000);
      const timeSinceLastShare = now - lastSubmission;
      
      // Estimate: Average 1 share per ~10 seconds at decent hashrate
      // Adjust based on actual hashrate if needed
      const averageShareInterval = 10;
      const timeUntilNext = Math.max(0, averageShareInterval - timeSinceLastShare);
      
      setTimeToNextShare(timeUntilNext);
    };

    updateNextShare();
    const interval = setInterval(updateNextShare, 1000);
    return () => clearInterval(interval);
  }, [lastSubmission]);

  // Calculate level system (exponential: 64, 128, 256, 512, 1024...)
  const calculateLevel = (): LevelInfo => {
    let level = 1;
    let threshold = 64;
    let previousThreshold = 0;
    
    while (totalShares >= threshold) {
      level++;
      previousThreshold = threshold;
      threshold *= 2;
    }
    
    const sharesInLevel = totalShares - previousThreshold;
    const sharesForNextLevel = threshold - previousThreshold;
    const progressPercent = (sharesInLevel / sharesForNextLevel) * 100;
    
    return {
      currentLevel: level,
      sharesInLevel,
      sharesForNextLevel: threshold,
      progressPercent
    };
  };

  // Calculate streak info
  const calculateStreak = (): StreakInfo => {
    const now = Math.floor(Date.now() / 1000);
    const uptimeDays = Math.floor((now - authorisedTimestamp) / (24 * 60 * 60));
    
    let nextBadge = 1;
    let badgeName = 'Bronze';
    
    if (uptimeDays >= 90) {
      nextBadge = 365;
      badgeName = 'Platinum';
    } else if (uptimeDays >= 30) {
      nextBadge = 90;
      badgeName = 'Diamond';
    } else if (uptimeDays >= 7) {
      nextBadge = 30;
      badgeName = 'Gold';
    } else if (uptimeDays >= 1) {
      nextBadge = 7;
      badgeName = 'Silver';
    }
    
    const progressPercent = (uptimeDays / nextBadge) * 100;
    
    return {
      days: uptimeDays,
      nextBadgeDays: nextBadge,
      progressPercent: Math.min(progressPercent, 100),
      badgeName
    };
  };

  const levelInfo = calculateLevel();
  const streakInfo = calculateStreak();

  // Format time display
  const formatTime = (d: number, h: number, m: number, s: number) => {
    if (d > 0) {
      return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Uptime Timer */}
      <div className="bg-background border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Uptime</span>
          <span className="text-2xl font-mono font-bold text-accent-3">
            {formatTime(uptime.days, uptime.hours, uptime.minutes, uptime.seconds)}
          </span>
        </div>
      </div>

      {/* Level Progress */}
      <div className="bg-background border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Mining Level {levelInfo.currentLevel}</span>
          <span className="text-xs text-muted-foreground">
            {totalShares.toLocaleString()} / {levelInfo.sharesForNextLevel.toLocaleString()} shares
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-accent-3 to-blue-500 h-full transition-all duration-500 ease-out relative"
            style={{ width: `${levelInfo.progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
          </div>
        </div>
        <div className="mt-1 text-xs text-right text-muted-foreground">
          {Math.floor(levelInfo.progressPercent)}% to Level {levelInfo.currentLevel + 1}
        </div>
      </div>

      {/* Reliability Streak */}
      <div className="bg-background border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <span className="text-sm font-medium">{streakInfo.days} Day Streak</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {streakInfo.badgeName} Badge
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-orange-500 to-yellow-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${streakInfo.progressPercent}%` }}
          ></div>
        </div>
        <div className="mt-1 text-xs text-right text-muted-foreground">
          {Math.floor(streakInfo.progressPercent)}% to {streakInfo.nextBadgeDays}-day {streakInfo.badgeName}
        </div>
      </div>

      {/* Next Share Countdown */}
      <div className="bg-background border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Next Share ETA</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold text-green-500">
              {formatCountdown(timeToNextShare)}
            </span>
            <span className="text-xs text-muted-foreground">avg ~10s</span>
          </div>
        </div>
      </div>

      {/* Hashrate Stability */}
      <div className="bg-background border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Hashrate Stability</span>
          <span className="text-xs text-muted-foreground">
            {currentHashrate.toFixed(2)} TH/s
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-600 to-emerald-500 h-full transition-all duration-500 ease-out"
            style={{ width: '85%' }}
          ></div>
        </div>
        <div className="mt-1 text-xs text-right text-muted-foreground">
          85% Stable
        </div>
      </div>
    </div>
  );
}
