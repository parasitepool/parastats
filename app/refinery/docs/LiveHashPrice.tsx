'use client';

import { useRefineryStatus } from '../RefineryShell';
import LiveDataBox from './LiveDataBox';

// Renders the quote shared by the Refinery shell's status poll, so the docs
// stay in sync with the live hashprice without fetching it again.
export default function LiveHashPrice() {
  const { status, unavailable } = useRefineryStatus();

  if (status) {
    return (
      <LiveDataBox title="Live refinery quote">
        {status.hash_price.toLocaleString()}{' '}
        <span className="text-[0.9em] font-semibold tracking-[0.08em]">sats/PHd</span>
      </LiveDataBox>
    );
  }

  return (
    <LiveDataBox title={unavailable ? 'Hashprice unavailable' : 'Loading hashprice'}>
      <span className="tabular-nums">—</span>{' '}
      <span className="text-[0.9em] font-semibold tracking-[0.08em]">sats/PHd</span>
    </LiveDataBox>
  );
}
