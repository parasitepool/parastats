'use client';

import type { UserRoundHistoryEntry } from '@/app/api/user/[address]/rounds/route';
import BlockBadge from './BlockBadge';

interface BadgeDisplayProps {
  rounds: UserRoundHistoryEntry[];
  loading?: boolean;
}

export default function BadgeDisplay({ rounds, loading }: BadgeDisplayProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-[44px] h-[44px] rounded-full bg-gray-700 animate-pulse" />
        <div className="w-[44px] h-[44px] rounded-full bg-gray-700 animate-pulse" />
      </div>
    );
  }

  if (!rounds || rounds.length === 0) {
    return <span className="text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {rounds.map((round, index) => (
        <BlockBadge
          key={round.block_height}
          blockHeight={round.block_height}
          rank={round.rank}
          totalParticipants={round.total_participants}
          isWinner={round.is_winner}
          index={index}
        />
      ))}
    </div>
  );
}
