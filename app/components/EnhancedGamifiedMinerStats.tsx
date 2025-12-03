'use client';

import React, { useEffect, useState } from 'react';
import AnimatedCounter from './AnimatedCounter';

interface EnhancedGamifiedMinerStatsProps {
  authorisedTimestamp: number;
  totalShares: number;
  totalWork: bigint; // Use bigint for large numbers
  currentHashrate: number;
  lastSubmission: number;
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
  unlockedDigits: number; // Number of digits revealed based on level
}

interface StreakInfo {
  days: number;
  nextBadgeDays: number;
  progressPercent: number;
  badgeName: string;
  badgeEmoji: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
}

export default function EnhancedGamifiedMinerStats({
  authorisedTimestamp,
  totalShares,
  totalWork,
  currentHashrate,
  lastSubmission
}: EnhancedGamifiedMinerStatsProps) {
  const [uptime, setUptime] = useState<UptimeDisplay>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [timeToNextShare, setTimeToNextShare] = useState(0);
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);
  const [pulseProgress, setPulseProgress] = useState(false);

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
      const averageShareInterval = 10;
      const timeUntilNext = Math.max(0, averageShareInterval - timeSinceLastShare);
      
      setTimeToNextShare(timeUntilNext);
    };

    updateNextShare();
    const interval = setInterval(updateNextShare, 1000);
    return () => clearInterval(interval);
  }, [lastSubmission]);

  // Progressive digit reveal system based on level
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
    
    // Unlock more digits as you level up
    // Level 1: 3 digits, Level 2: 4 digits, etc.
    const unlockedDigits = Math.min(2 + level, 15); // Cap at 15 digits
    
    return {
      currentLevel: level,
      sharesInLevel,
      sharesForNextLevel: threshold,
      progressPercent,
      unlockedDigits
    };
  };

  // Calculate streak with badge emojis
  const calculateStreak = (): StreakInfo => {
    const now = Math.floor(Date.now() / 1000);
    const uptimeDays = Math.floor((now - authorisedTimestamp) / (24 * 60 * 60));
    
    let nextBadge = 1;
    let badgeName = 'Bronze Miner';
    let badgeEmoji = '🥉';
    
    if (uptimeDays >= 90) {
      nextBadge = 365;
      badgeName = 'Platinum Miner';
      badgeEmoji = '💎';
    } else if (uptimeDays >= 30) {
      nextBadge = 90;
      badgeName = 'Diamond Miner';
      badgeEmoji = '💠';
    } else if (uptimeDays >= 7) {
      nextBadge = 30;
      badgeName = 'Gold Miner';
      badgeEmoji = '🏆';
    } else if (uptimeDays >= 1) {
      nextBadge = 7;
      badgeName = 'Silver Miner';
      badgeEmoji = '🥈';
    }
    
    const progressPercent = (uptimeDays / nextBadge) * 100;
    
    return {
      days: uptimeDays,
      nextBadgeDays: nextBadge,
      progressPercent: Math.min(progressPercent, 100),
      badgeName,
      badgeEmoji
    };
  };

  // Calculate achievements
  const calculateAchievements = (): Achievement[] => {
    const totalWorkNumber = Number(totalWork);
    
    return [
      {
        id: 'first_1k',
        name: 'Getting Started',
        description: 'Submit 1,000 shares',
        icon: '⚙️',
        unlocked: totalShares >= 1000,
        progress: Math.min((totalShares / 1000) * 100, 100)
      },
      {
        id: 'first_10k',
        name: 'Dedicated Miner',
        description: 'Submit 10,000 shares',
        icon: '⛏️',
        unlocked: totalShares >= 10000,
        progress: Math.min((totalShares / 10000) * 100, 100)
      },
      {
        id: 'week_streak',
        name: 'Week Warrior',
        description: '7 days online',
        icon: '🔥',
        unlocked: uptime.days >= 7,
        progress: Math.min((uptime.days / 7) * 100, 100)
      },
      {
        id: 'month_streak',
        name: 'Marathon Miner',
        description: '30 days online',
        icon: '🏅',
        unlocked: uptime.days >= 30,
        progress: Math.min((uptime.days / 30) * 100, 100)
      },
      {
        id: 'level_5',
        name: 'Level 5 Master',
        description: 'Reach Level 5',
        icon: '⭐',
        unlocked: calculateLevel().currentLevel >= 5,
        progress: Math.min((calculateLevel().currentLevel / 5) * 100, 100)
      },
      {
        id: 'level_10',
        name: 'Level 10 Legend',
        description: 'Reach Level 10',
        icon: '🌟',
        unlocked: calculateLevel().currentLevel >= 10,
        progress: Math.min((calculateLevel().currentLevel / 10) * 100, 100)
      }
    ];
  };

  const levelInfo = calculateLevel();
  const streakInfo = calculateStreak();
  const achievements = calculateAchievements();

  // Pulse effect when progress increases
  useEffect(() => {
    setPulseProgress(true);
    const timeout = setTimeout(() => setPulseProgress(false), 500);
    return () => clearTimeout(timeout);
  }, [levelInfo.progressPercent]);

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
      {/* Mystery Work Counter with Progressive Reveal */}
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 border-purple-500/50 p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <span className="text-sm font-medium text-purple-300">Total Work Earned</span>
            </div>
            <div className="text-xs text-purple-400 bg-purple-900/30 px-3 py-1 rounded-full">
              Level {levelInfo.currentLevel} • {levelInfo.unlockedDigits} digits revealed
            </div>
          </div>
          
          <div className="text-4xl font-bold font-mono text-center py-4 text-white">
            <AnimatedCounter 
              value={totalWork} 
              revealedDigits={levelInfo.unlockedDigits}
            />
          </div>
          
          <div className="text-center text-xs text-purple-300 mt-2">
            ⚡ Level up to reveal more digits! ⚡
          </div>
        </div>
      </div>

      {/* Uptime Timer with Glow Effect */}
      <div className="bg-background border border-accent-3/50 p-4 relative overflow-hidden group hover:border-accent-3 transition-colors">
        <div className="absolute inset-0 bg-accent-3/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">⏱️ Mining Time</span>
          <span className="text-2xl font-mono font-bold text-accent-3 drop-shadow-[0_0_8px_rgba(var(--accent-3),0.5)]">
            {formatTime(uptime.days, uptime.hours, uptime.minutes, uptime.seconds)}
          </span>
        </div>
      </div>

      {/* Level Progress with Particles */}
      <div className="bg-background border border-border p-4 relative overflow-hidden">
        {pulseProgress && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent-3/20 to-transparent animate-pulse-once"></div>
        )}
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{levelInfo.currentLevel <= 5 ? '⚙️' : levelInfo.currentLevel <= 10 ? '⛏️' : '💎'}</span>
              <span className="text-sm font-medium">Level {levelInfo.currentLevel}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {totalShares.toLocaleString()} / {levelInfo.sharesForNextLevel.toLocaleString()} shares
            </span>
          </div>
          
          <div className="relative w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-accent-3 via-blue-500 to-accent-3 h-full transition-all duration-500 ease-out relative"
              style={{ width: `${levelInfo.progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
          
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{Math.floor(levelInfo.progressPercent)}% to Level {levelInfo.currentLevel + 1}</span>
            <span className="text-accent-3 font-medium">+{levelInfo.unlockedDigits + 1} digits at next level!</span>
          </div>
        </div>
      </div>

      {/* Reliability Streak with Fire Animation */}
      <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-2 border-orange-500/50 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,165,0,0.1),transparent_50%)]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl animate-pulse">{streakInfo.badgeEmoji}</span>
              <div>
                <div className="text-sm font-medium">{streakInfo.days} Day Streak</div>
                <div className="text-xs text-orange-300">{streakInfo.badgeName}</div>
              </div>
            </div>
            <span className="text-xs text-muted-foreground bg-orange-900/30 px-2 py-1 rounded">
              Next: {streakInfo.nextBadgeDays}d
            </span>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 h-full transition-all duration-500 ease-out relative"
              style={{ width: `${streakInfo.progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
            </div>
          </div>
          
          <div className="mt-1 text-xs text-right text-orange-300">
            {Math.floor(streakInfo.progressPercent)}% to {streakInfo.badgeName}
          </div>
        </div>
      </div>

      {/* Next Share Countdown with Pulse */}
      <div className="bg-background border border-green-500/50 p-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">⚡ Next Share</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-mono font-bold ${timeToNextShare <= 3 ? 'text-green-400 animate-pulse' : 'text-green-500'}`}>
              {formatCountdown(timeToNextShare)}
            </span>
            <span className="text-xs text-muted-foreground">~10s avg</span>
          </div>
        </div>
        {timeToNextShare <= 3 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 animate-pulse"></div>
        )}
      </div>

      {/* Achievements Grid */}
      <div className="bg-background border border-border p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <span>🏆</span>
          <span>Achievements</span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`
                relative p-3 rounded border transition-all
                ${achievement.unlocked 
                  ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/50' 
                  : 'bg-gray-900/20 border-gray-700'
                }
              `}
            >
              <div className="text-center">
                <div className={`text-3xl mb-1 ${achievement.unlocked ? 'filter-none' : 'grayscale opacity-30'}`}>
                  {achievement.icon}
                </div>
                <div className={`text-xs font-medium ${achievement.unlocked ? 'text-white' : 'text-gray-500'}`}>
                  {achievement.name}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {achievement.description}
                </div>
                {!achievement.unlocked && achievement.progress !== undefined && (
                  <div className="mt-2 w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-gray-500 h-full transition-all"
                      style={{ width: `${achievement.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        @keyframes pulse-once {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .animate-pulse-once {
          animation: pulse-once 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
