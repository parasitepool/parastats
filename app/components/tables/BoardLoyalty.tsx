'use client';

import { useState, useEffect } from 'react';
import { formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';

interface User {
  id: number;
  address: string;
  total_blocks: number;
  rank?: number;
}

interface LoyaltyBoardProps {
  initialData?: User[];
}

export default function BoardLoyalty({ initialData }: LoyaltyBoardProps) {
  const [data, setData] = useState<User[]>(initialData || []);
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
      const response = await fetch('/api/leaderboard?type=loyalty&limit=99');
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
      console.error('Error fetching loyalty data:', error);
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
      key: 'total_blocks',
      header: 'Blocks',
      align: 'right',
      render: (value) => (value as number).toLocaleString()
    }
  ];

  return (
    <Board
      title="Top Loyalty"
      data={data}
      columns={columns}
      isLoading={isLoading}
    />
  );
}
