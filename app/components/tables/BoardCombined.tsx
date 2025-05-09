'use client';

import { useState, useEffect } from 'react';
import { formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';

interface User {
  id: number;
  address: string;
  diff: number;
  authorised_at: number;
  diff_rank: number;
  loyalty_rank: number;
  combined_score: number;
  rank?: number;
}

interface BoardCombinedProps {
  initialData?: User[];
}

export default function BoardCombined({ initialData }: BoardCombinedProps) {
  const [data, setData] = useState<User[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
  }, [initialData]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/leaderboard?type=combined&limit=15');
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
      console.error('Error fetching combined data:', error);
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
      key: 'diff_rank',
      header: 'Diff',
      align: 'right',
      render: (value) => `#${value}`
    },
    {
      key: 'loyalty_rank',
      header: 'Loyalty',
      align: 'right',
      render: (value) => `#${value}`
    }
  ];

  return (
    <Board
      title="User Leaderboard"
      data={data}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
