'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDifficulty, formatAddress } from '@/app/utils/formatters';
import Board, { BoardColumn } from '@/app/components/tables/Board';

interface Round {
  block_height: number;
  block_hash: string | null;
  coinbase_value: number | null;
  winner_diff: number | null;
  winner_username: string | null;
  participant_status: string;
}

interface RoundParticipant {
  rank: number;
  address: string;
  claimed: boolean;
  top_diff: number;
  blocks_participated: number;
}

interface ParticipantRow {
  id: number;
  address: string;
  claimed: boolean;
  top_diff: number;
  blocks_participated: number;
  rank: number;
}

type LeaderboardType = 'difficulty' | 'participation';

const addressColumn: BoardColumn<ParticipantRow> = {
  key: 'address',
  header: 'Address',
  render: (value) => <span>{formatAddress(value as string)}</span>
};

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

function toRows(data: RoundParticipant[]): ParticipantRow[] {
  return data.map((p, i) => ({
    id: i + 1,
    address: p.address,
    claimed: p.claimed,
    top_diff: p.top_diff,
    blocks_participated: p.blocks_participated,
    rank: p.rank,
  }));
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [diffParticipants, setDiffParticipants] = useState<ParticipantRow[]>([]);
  const [partParticipants, setPartParticipants] = useState<ParticipantRow[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<LeaderboardType>('difficulty');
  const latestRequest = useRef(0);
  const expandedStatus = rounds.find(r => r.block_height === expandedRound)?.participant_status;
  const prevStatusRef = useRef(expandedStatus);

  useEffect(() => {
    fetchRounds();
  }, []);

  // Always poll rounds: 30s when incomplete rounds exist, 120s otherwise
  useEffect(() => {
    const hasIncomplete = rounds.some(
      r => r.block_height !== 0 && r.participant_status !== 'complete'
    );
    const interval = setInterval(fetchRounds, hasIncomplete ? 30_000 : 120_000);
    return () => clearInterval(interval);
  }, [rounds]);

  const fetchRounds = async () => {
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
  };

  const fetchParticipants = useCallback(async (blockHeight: number) => {
    const requestId = Date.now();
    latestRequest.current = requestId;
    setParticipantsLoading(true);
    try {
      const [diffRes, partRes] = await Promise.all([
        fetch(`/api/rounds/${blockHeight}?type=difficulty&limit=99`),
        fetch(`/api/rounds/${blockHeight}?type=participation&limit=99`),
      ]);
      if (latestRequest.current !== requestId) return;
      if (diffRes.status === 202 || partRes.status === 202) {
        setDiffParticipants([]);
        setPartParticipants([]);
        return;
      }
      if (!diffRes.ok || !partRes.ok) throw new Error('Failed to fetch participants');
      const [diffData, partData]: [RoundParticipant[], RoundParticipant[]] = await Promise.all([
        diffRes.json(),
        partRes.json(),
      ]);
      setDiffParticipants(toRows(diffData));
      setPartParticipants(toRows(partData));
    } catch (error) {
      if (latestRequest.current !== requestId) return;
      console.error('Error fetching participants:', error);
      setDiffParticipants([]);
      setPartParticipants([]);
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
      setDiffParticipants([]);
      setPartParticipants([]);
    } else {
      setExpandedRound(blockHeight);
      fetchParticipants(blockHeight);
    }
  };

  if (loading) {
    return (
      <main className="flex-grow p-4">
        <div className="text-foreground/60">Loading rounds...</div>
      </main>
    );
  }

  return (
    <main className="flex-grow p-4">
      <h1 className="text-3xl font-bold mb-6">Round History</h1>

      {rounds.length === 0 ? (
        <div className="text-foreground/60">No completed rounds yet.</div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => (
            <div key={round.block_height} className="border border-border bg-background shadow-md">
              <button
                onClick={() => toggleRound(round.block_height)}
                className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-foreground/5 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold font-mono">
                    {round.block_height === 0 ? (
                      <span className="text-accent-1">Current Round</span>
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
                  {round.winner_username && (
                    <span className="text-sm text-foreground/60">
                      Winner: {formatAddress(round.winner_username)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-foreground/60">
                  {round.winner_diff !== null && (
                    <span>Diff: {formatDifficulty(round.winner_diff)}</span>
                  )}
                  {round.coinbase_value !== null && (
                    <span>{(round.coinbase_value / 1e8).toFixed(8)} BTC</span>
                  )}
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
                  <span className="text-foreground/40">{expandedRound === round.block_height ? '▲' : '▼'}</span>
                </div>
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
                        <button
                          onClick={() => setMobileTab('difficulty')}
                          className={`px-3 py-1 transition-colors cursor-pointer ${
                            mobileTab === 'difficulty'
                              ? 'bg-foreground text-background'
                              : 'bg-secondary text-foreground/80 hover:bg-primary-hover hover:text-foreground'
                          }`}
                        >
                          Difficulty
                        </button>
                        <button
                          onClick={() => setMobileTab('participation')}
                          className={`px-3 py-1 transition-colors cursor-pointer ${
                            mobileTab === 'participation'
                              ? 'bg-foreground text-background'
                              : 'bg-secondary text-foreground/80 hover:bg-primary-hover hover:text-foreground'
                          }`}
                        >
                          Participation
                        </button>
                      </div>
                      {/* Mobile: single table based on active tab */}
                      <div className="md:hidden">
                        <Board
                          title={mobileTab === 'difficulty' ? 'Top Difficulties' : 'Most Participation'}
                          data={mobileTab === 'difficulty' ? diffParticipants : partParticipants}
                          columns={mobileTab === 'difficulty' ? diffColumns : participationColumns}
                          isLoading={participantsLoading}
                        />
                      </div>
                      {/* Desktop: side by side */}
                      <div className="hidden md:grid md:grid-cols-2 gap-4">
                        <Board
                          title="Top Difficulties"
                          data={diffParticipants}
                          columns={diffColumns}
                          isLoading={participantsLoading}
                        />
                        <Board
                          title="Most Participation"
                          data={partParticipants}
                          columns={participationColumns}
                          isLoading={participantsLoading}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
