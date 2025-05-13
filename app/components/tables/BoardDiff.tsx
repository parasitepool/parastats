'use client';

import { useState, useEffect } from 'react';
import { formatDifficulty, formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
import { InfoIcon } from '../icons';
import DifficultyInfoModal from '../modals/DifficultyInfoModal';

interface User {
  id: number;
  address: string;
  diff: number;
  authorised_at: number;
  rank?: number;
}

interface LeaderboardProps {
  initialData?: User[];
}

// type TimeRange = 'weekly' | 'monthly' | 'lifetime';

export default function BoardDiff({ initialData }: LeaderboardProps) {
  const [data, setData] = useState<User[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  // const [timeRange, setTimeRange] = useState<TimeRange>('weekly');

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [initialData]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/leaderboard?type=difficulty&limit=99');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const users = await response.json();
      // Add rank to each user
      const rankedUsers = users.map((user: User, index: number) => ({
        ...user,
        rank: index + 1
      }));
      setData(rankedUsers);
    } catch (error) {
      console.error('Error fetching difficulty data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: BoardColumn<User>[] = [
    {
      key: 'address',
      header: 'Address',
      render: (value) => formatAddress(value as string)
    },
    {
      key: 'diff',
      header: 'Diff',
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
        // timeRange={{
        //   current: timeRange,
        //   options: ['weekly', 'monthly', 'lifetime'],
        //   onChange: (range) => setTimeRange(range as TimeRange)
        // }}
      />
      <DifficultyInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </>
  );
}
