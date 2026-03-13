'use client';

import { formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
import { useRoundLeaderboard } from './useRoundLeaderboard';

interface User {
  id: number;
  address: string;
  claimed?: boolean;
  total_blocks: number;
  rank?: number;
}

interface LoyaltyBoardProps {
  initialData?: User[];
}

export default function BoardLoyalty({ initialData }: LoyaltyBoardProps) {
  const { data, isLoading, roundMode, setRoundMode } = useRoundLeaderboard<User>('loyalty', 99, initialData);

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
      key: 'total_blocks',
      header: roundMode === 'round' ? 'Blocks Participated' : 'Blocks',
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
      roundToggle={{
        current: roundMode,
        onChange: setRoundMode
      }}
    />
  );
}
