'use client';

import { useState, useEffect } from 'react';
import { formatDifficulty, formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
import { TrophyIcon } from '../icons';

interface UserWin {
  id: number;
  address: string;
  fullAddress: string;
  win_count: number;
  total_diff: number;
  avg_diff: number;
  rank?: number;
}

interface BoardBlockWinnersProps {
  initialData?: UserWin[];
}

export default function BoardBlockWinners({ initialData }: BoardBlockWinnersProps) {
  const [data, setData] = useState<UserWin[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData) {
      fetchData();
    }
    
    // Set up auto-refresh every 60 seconds
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 60000);
    
    // Clean up interval on component unmount
    return () => clearInterval(refreshInterval);
  }, [initialData]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/highest-diff?type=winners&limit=99');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const users = await response.json();
      // Add rank and id to each user
      const rankedUsers = users.map((user: Omit<UserWin, 'id' | 'rank'>, index: number) => ({
        ...user,
        id: index + 1,
        rank: index + 1
      }));
      setData(rankedUsers);
    } catch (error) {
      console.error('Error fetching block winners data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: BoardColumn<UserWin>[] = [
    {
      key: 'address',
      header: 'Address',
      render: (value) => formatAddress(value as string)
    },
    {
      key: 'win_count',
      header: 'Wins',
      align: 'right',
      render: (value) => (value as number).toLocaleString()
    },
    {
      key: 'avg_diff',
      header: 'Avg Diff',
      align: 'right',
      render: (value) => formatDifficulty(value as number)
    }
  ];

  return (
    <Board
      title={
        <div className="flex items-center gap-2">
          <TrophyIcon className="h-5 w-5 text-accent-1" />
          <span>Block Winners</span>
        </div>
      }
      data={data}
      columns={columns}
      isLoading={isLoading}
    />
  );
}

