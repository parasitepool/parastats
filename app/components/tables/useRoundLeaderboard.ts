import { useState, useEffect, useRef } from 'react';
import type { RoundMode } from './Board';

interface RankedUser {
  rank: number;
  [key: string]: unknown;
}

export function useRoundLeaderboard<T>(type: string, limit: number, initialData?: T[]) {
  const [data, setData] = useState<T[]>(initialData || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [roundMode, setRoundMode] = useState<RoundMode>('round');
  const isInitialRef = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    isInitialRef.current = true;

    const doFetch = async () => {
      try {
        if (isInitialRef.current) setIsLoading(true);
        const roundParam = roundMode === 'round' ? '&round=current' : '';
        const response = await fetch(
          `/api/leaderboard?type=${type}&limit=${limit}${roundParam}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Failed to fetch data');
        const users = await response.json();
        const rankedUsers = users.map((user: RankedUser, index: number) => ({
          ...user,
          rank: index + 1
        }));
        setData(rankedUsers);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error(`Error fetching ${type} data:`, error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          isInitialRef.current = false;
        }
      }
    };

    doFetch();
    const refreshInterval = setInterval(doFetch, 60000);

    return () => {
      controller.abort();
      clearInterval(refreshInterval);
    };
  }, [roundMode, type, limit]);

  return { data, isLoading, roundMode, setRoundMode };
}
