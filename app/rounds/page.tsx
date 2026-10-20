'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { formatDifficulty, formatAddress } from '@/app/utils/formatters';
import { getHashrate } from '@/app/utils/api';
import Board, { BoardColumn } from '@/app/components/tables/Board';

interface Round {
  block_height: number;
  block_hash: string | null;
  coinbase_value: number | null;
  winner_diff: number | null;
  winner_username: string | null;
  participant_status: string;
  total_work: number;
  network_difficulty: number | null;
}

interface RoundParticipant {
  rank: number;
  address: string;
  claimed: boolean;
  top_diff: number;
  blocks_participated: number;
  total_work: number;
}

interface ParticipantRow {
  id: number;
  address: string;
  claimed: boolean;
  top_diff: number;
  blocks_participated: number;
  total_work: number;
  rank: number;
}

type LeaderboardType = 'work' | 'difficulty' | 'participation';

const addressColumn: BoardColumn<ParticipantRow> = {
  key: 'address',
  header: 'Address',
  render: (value) => <span>{formatAddress(value as string)}</span>
};

const workColumns: BoardColumn<ParticipantRow>[] = [
  addressColumn,
  {
    key: 'total_work',
    header: 'Work',
    align: 'right',
    render: (value) => formatDifficulty(value as number)
  }
];

const diffColumns: BoardColumn<ParticipantRow>[] = [
  addressColumn,
  {
    key: 'top_diff',
    header: 'Top Diff',
    align: 'right',
    render: (value) => formatDifficulty(value as number)
  }
];

const participationColumns: BoardColumn<ParticipantRow>[] = [
  addressColumn,
  {
    key: 'blocks_participated',
    header: 'Blocks Participated',
    align: 'right',
    render: (value) => (value as number).toLocaleString()
  }
];

const LEADERBOARDS: { type: LeaderboardType; label: string; title: string; columns: BoardColumn<ParticipantRow>[] }[] = [
  { type: 'difficulty', label: 'Difficulty', title: 'Top Difficulties', columns: diffColumns },
  { type: 'participation', label: 'Participation', title: 'Top Loyalty', columns: participationColumns },
  { type: 'work', label: 'Work', title: 'Most Work', columns: workColumns },
];

const emptyParticipants: Record<LeaderboardType, ParticipantRow[]> = {
  work: [],
  difficulty: [],
  participation: [],
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:text-right">
      <div className="text-xs text-foreground/40">{label}</div>
      <div className="text-base text-foreground/80">{value}</div>
    </div>
  );
}

function toRows(data: RoundParticipant[]): ParticipantRow[] {
  return data.map((p, i) => ({
    id: i + 1,
    address: p.address,
    claimed: p.claimed,
    top_diff: p.top_diff,
    blocks_participated: p.blocks_participated,
    total_work: p.total_work,
    rank: p.rank,
  }));
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Record<LeaderboardType, ParticipantRow[]>>(emptyParticipants);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeaderboardType>('difficulty');
  const [networkDifficulty, setNetworkDifficulty] = useState<number | null>(null);
  const latestRequest = useRef(0);
  const expandedStatus = rounds.find(r => r.block_height === expandedRound)?.participant_status;
  const prevStatusRef = useRef(expandedStatus);

  const fetchRounds = useCallback(async () => {
    try {
      const response = await fetch('/api/rounds');
      if (!response.ok) throw new Error('Failed to fetch rounds');
      const data = await response.json();
      setRounds(data);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  useEffect(() => {
    const fetchNetworkDifficulty = async () => {
      try {
        const data = await getHashrate();
        setNetworkDifficulty(data.currentDifficulty ?? null);
      } catch (error) {
        console.error('Error fetching current network difficulty:', error);
      }
    };
    fetchNetworkDifficulty();
    const interval = setInterval(fetchNetworkDifficulty, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Always poll rounds: 30s when incomplete rounds exist, 120s otherwise
  useEffect(() => {
    const hasIncomplete = rounds.some(
      r => r.block_height !== 0 && r.participant_status !== 'complete'
    );
    const interval = setInterval(fetchRounds, hasIncomplete ? 30_000 : 120_000);
    return () => clearInterval(interval);
  }, [rounds, fetchRounds]);

  const fetchParticipants = useCallback(async (blockHeight: number) => {
    const requestId = Date.now();
    latestRequest.current = requestId;
    setParticipantsLoading(true);
    try {
      const responses = await Promise.all(
        LEADERBOARDS.map(lb => fetch(`/api/rounds/${blockHeight}?type=${lb.type}&limit=99`))
      );
      if (latestRequest.current !== requestId) return;
      if (responses.some(res => res.status === 202)) {
        setParticipants(emptyParticipants);
        return;
      }
      if (responses.some(res => !res.ok)) throw new Error('Failed to fetch participants');
      const data: RoundParticipant[][] = await Promise.all(responses.map(res => res.json()));
      const next = { ...emptyParticipants };
      LEADERBOARDS.forEach((lb, i) => { next[lb.type] = toRows(data[i]); });
      setParticipants(next);
    } catch (error) {
      if (latestRequest.current !== requestId) return;
      console.error('Error fetching participants:', error);
      setParticipants(emptyParticipants);
    } finally {
      if (latestRequest.current === requestId) {
        setParticipantsLoading(false);
      }
    }
  }, []);

  // Auto-fetch participants when expanded round transitions to 'complete'
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = expandedStatus;

    if (
      expandedRound !== null &&
      expandedStatus === 'complete' &&
      prev !== 'complete' &&
      prev !== undefined
    ) {
      fetchParticipants(expandedRound);
    }
  }, [expandedStatus, expandedRound, fetchParticipants]);

  const toggleRound = (blockHeight: number) => {
    if (expandedRound === blockHeight) {
      setExpandedRound(null);
      setParticipants(emptyParticipants);
    } else {
      setExpandedRound(blockHeight);
      fetchParticipants(blockHeight);
    }
  };

  if (loading) {
    return (
      <main className="flex-grow py-4">
        <div className="text-foreground/60">Loading blocks...</div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-4">
      {rounds.length === 0 ? (
        <div className="text-foreground/60">No completed blocks yet.</div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => {
            const networkDiff = round.block_height === 0
              ? networkDifficulty
              : round.network_difficulty;
            return (
              <div key={round.block_height} className="border border-border bg-background shadow-md">
                <button
                  onClick={() => toggleRound(round.block_height)}
                  className="relative w-full p-4 flex flex-col gap-3 sm:grid sm:grid-cols-[auto_minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_auto] sm:items-center sm:gap-4 hover:bg-foreground/5 transition-colors cursor-pointer text-left"
                >
                {/* Identity: block height + winner */}
                <div className="flex flex-col gap-1 min-w-0 pr-6 sm:pr-0">
                  <span className="text-lg font-semibold font-mono">
                    {round.block_height === 0 ? (
                      <span className="text-accent-1">Current Block</span>
                    ) : (
                      <>
                        Block{' '}
                        <a
                          href={`https://mempool.space/block/${round.block_height}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-1 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {round.block_height.toLocaleString()}
                        </a>
                      </>
                    )}
                  </span>
                  {round.block_height !== 0 && round.participant_status !== 'complete' && (
                    <span className={
                      round.participant_status === 'error' ? 'text-red-500' :
                      'text-yellow-500'
                    }>
                      {round.participant_status === 'fetching' ? 'Loading data...' :
                       round.participant_status === 'error' ? 'Error' :
                       'Pending'}
                    </span>
                  )}
                </div>

                {/* Stats: 2-col grid on mobile, aligned columns on desktop */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:contents">
                  {round.winner_username ? (
                    <div className="col-span-2 sm:col-span-1 min-w-0">
                      <div className="text-xs text-foreground/40">Winner</div>
                      <Link
                        href={`/user/${round.winner_username}`}
                        className="text-base text-foreground/80 hover:underline break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {round.winner_username}
                      </Link>
                    </div>
                  ) : <div className="hidden sm:block" />}
                  {round.winner_diff !== null ? (
                    <StatCell
                      label={round.block_height === 0 ? 'Best diff' : 'Diff'}
                      value={formatDifficulty(round.winner_diff)}
                    />
                  ) : <div className="hidden sm:block" />}
                  {networkDiff !== null ? (
                    <StatCell label="Net" value={formatDifficulty(networkDiff)} />
                  ) : <div className="hidden sm:block" />}
                  {round.total_work > 0 ? (
                    <StatCell label="Work" value={formatDifficulty(round.total_work)} />
                  ) : <div className="hidden sm:block" />}
                  {round.coinbase_value !== null ? (
                    <StatCell label="Reward" value={`${(round.coinbase_value / 1e8).toFixed(8)} BTC`} />
                  ) : <div className="hidden sm:block" />}
                </div>

                <span className="absolute top-4 right-4 sm:static text-foreground/40">
                  {expandedRound === round.block_height ? '▲' : '▼'}
                </span>
              </button>

              {expandedRound === round.block_height && (
                <div className="border-t border-border p-4">
                  {round.block_height !== 0 && round.participant_status !== 'complete' ? (
                    <div className="text-foreground/60 py-4 text-center">
                      {round.participant_status === 'fetching' ? 'Loading participant data... (this may take a few minutes)' :
                       round.participant_status === 'error' ? 'Error loading participant data. Reload to check status.' :
                       'Participant data pending...'}
                    </div>
                  ) : (
                    <>
                      {/* Mobile: tabs */}
                      <div className="flex space-x-2 mb-4 md:hidden">
                        {LEADERBOARDS.map(lb => (
                          <button
                            key={lb.type}
                            onClick={() => setMobileTab(lb.type)}
                            className={`px-3 py-1 transition-colors cursor-pointer ${
                              mobileTab === lb.type
                                ? 'bg-foreground text-background'
                                : 'bg-secondary text-foreground/80 hover:bg-primary-hover hover:text-foreground'
                            }`}
                          >
                            {lb.label}
                          </button>
                        ))}
                      </div>
                      {/* Mobile: single table based on active tab */}
                      <div className="md:hidden">
                        {LEADERBOARDS.filter(lb => lb.type === mobileTab).map(lb => (
                          <Board
                            key={lb.type}
                            title={lb.title}
                            data={participants[lb.type]}
                            columns={lb.columns}
                            isLoading={participantsLoading}
                          />
                        ))}
                      </div>
                      {/* Desktop: side by side */}
                      <div className="hidden md:grid md:grid-cols-3 gap-4">
                        {LEADERBOARDS.map(lb => (
                          <Board
                            key={lb.type}
                            title={lb.title}
                            data={participants[lb.type]}
                            columns={lb.columns}
                            isLoading={participantsLoading}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
