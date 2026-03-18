'use client';

import { useState } from 'react';
import { formatDifficulty, formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
import { InfoIcon } from '../icons';
import DifficultyInfoModal from '../modals/DifficultyInfoModal';
import { useRoundLeaderboard } from './useRoundLeaderboard';

interface User {
  id: number;
  address: string;
  claimed?: boolean;
  diff: number;
  authorised_at: number;
  rank?: number;
}

interface LeaderboardProps {
  initialData?: User[];
}

export default function BoardDiff({ initialData }: LeaderboardProps) {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const { data, isLoading, roundMode, setRoundMode } = useRoundLeaderboard<User>('difficulty', 99, initialData);

  const columns: BoardColumn<User>[] = [
    {
      key: 'address',
      header: 'Address',
      render: (value) => (
        <span>
          {formatAddress(value as string)}
        </span>
      )
    },
    {
      key: 'diff',
      header: roundMode === 'round' ? 'Top Diff' : 'Best Ever',
      align: 'right',
      render: (value) => formatDifficulty(value as number)
    }
  ];

  return (
    <>
      <Board
        title={
          <div className="flex items-center gap-2">
            <span>Top Difficulties</span>
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="p-1 rounded-full hover:bg-foreground/10 transition-colors cursor-pointer"
              aria-label="Difficulty information"
            >
              <InfoIcon className="h-5 w-5 text-foreground/60" />
            </button>
          </div>
        }
        data={data}
        columns={columns}
        isLoading={isLoading}
        roundToggle={{
          current: roundMode,
          onChange: setRoundMode
        }}
      />
      <DifficultyInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </>
  );
}
