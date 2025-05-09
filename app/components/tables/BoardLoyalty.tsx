'use client';

import { useState, useEffect } from 'react';
import { formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';

interface User {
  id: number;
  address: string;
  authorised_at: number;
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
  }, [initialData]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/leaderboard?type=loyalty&limit=15');
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

  // Calculate uptime in days and hours
  const calculateUptime = (authorisedAt: number): { days: number; hours: number } => {
    const now = Math.floor(Date.now() / 1000);
    const uptimeSeconds = now - authorisedAt;
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    return { days, hours };
  };

  // Format uptime in days and hours
  const formatUptime = (authorisedAt: number): string => {
    const { days, hours } = calculateUptime(authorisedAt);
    return `${days}d ${hours.toString().padStart(2, '0')}h`;
  };

  const columns: BoardColumn<User>[] = [
    {
      key: 'address',
      header: 'Address',
      render: (value) => formatAddress(value as string)
    },
    {
      key: 'authorised_at',
      header: 'Uptime',
      align: 'right',
      render: (value) => formatUptime(value as number)
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
