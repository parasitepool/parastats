'use client';

import { formatDifficulty, formatAddress } from '../../utils/formatters';
import Board, { BoardColumn } from './Board';
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
    <Board
      title="Top Difficulties"
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
