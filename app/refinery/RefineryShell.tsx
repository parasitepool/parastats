'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import RouterStats from '@/app/components/refinery/RouterStats';
import type { RouterStatus } from '@/app/api/refinery/types';
import { useRefineryResource } from '@/app/hooks/useRefineryResource';

interface RefineryStatusValue {
  status: RouterStatus | null;
  unavailable: boolean;
}

const RefineryStatusContext = createContext<RefineryStatusValue>({ status: null, unavailable: false });

export function useRefineryStatus(): RefineryStatusValue {
  return useContext(RefineryStatusContext);
}

export default function RefineryShell({ children }: { children: ReactNode }) {
  const { data: status, unavailable: statusUnavailable } = useRefineryResource<RouterStatus>('/api/refinery/status');

  return (
    <RefineryStatusContext.Provider value={{ status, unavailable: statusUnavailable }}>
      <main className="flex-grow py-4 space-y-4 sm:space-y-6">
        <RouterStats status={status} unavailable={statusUnavailable} />
        {children}
      </main>
    </RefineryStatusContext.Provider>
  );
}
