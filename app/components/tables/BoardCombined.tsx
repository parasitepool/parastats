'use client';

import { formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
import { useRoundLeaderboard } from './useRoundLeaderboard';

interface User {
  id: number;
  address: string;
  claimed?: boolean;
  diff: number;
  total_blocks: number;
  diff_rank: number;
  loyalty_rank: number;
  combined_score: number;
  rank?: number;
}

interface BoardCombinedProps {
  initialData?: User[];
}

export default function BoardCombined({ initialData }: BoardCombinedProps) {
  const { data, isLoading, roundMode, setRoundMode } = useRoundLeaderboard<User>('combined', 9, initialData);

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
      title="Leaderboard"
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
