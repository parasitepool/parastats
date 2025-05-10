'use client';

import { useState, useEffect } from 'react';
import { formatDifficulty, formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';

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

type TimeRange = 'weekly' | 'monthly' | 'lifetime';

export default function BoardDiff({ initialData }: LeaderboardProps) {
  const [data, setData] = useState<User[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');

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
    <Board
      title="Top Difficulties"
      data={data}
      columns={columns}
      isLoading={isLoading}
      timeRange={{
        current: timeRange,
        options: ['weekly', 'monthly', 'lifetime'],
        onChange: (range) => setTimeRange(range as TimeRange)
      }}
    />
  );
}
