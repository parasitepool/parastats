// Shared types and helpers for the Auction component, mirroring guac's
// dispenser auction API (src/dispenser/auction.rs).

export type AuctionStatus =
  | 'open'
  | 'extended'
  | 'closed'
  | 'settled'
  | 'unsold'
  | 'cancelled';

export type AuctionSource =
  | { kind: 'slot'; tier: string; slot: number }
  | { kind: 'listing'; listing_id: string }
  | { kind: 'pool' };

export type Payout = 'address' | 'refinery' | 'distribution';

export interface AuctionInfo {
  id: string;
  asset: string;
  source: AuctionSource;
  inscription_id: string;
  outpoint: string;
  inscription_value: number;
  seller_username: string;
  reserve: number;
  increment: number;
  start_time: number; // unix secs
  end_time: number; // unix secs
  anti_snipe_secs: number;
  status: AuctionStatus;
  current_high: number | null;
  min_next_bid: number;
  settlement_txid: string | null;
  payout_address: string;
  refinery_order_id?: number;
  payout: Payout;
}

export interface BidInfo {
  id: string;
  bidder_payment_address: string;
  amount: number;
  created_at: number;
  valid: boolean;
  superseded: boolean;
}

export function isLive(auction: AuctionInfo): boolean {
  return auction.status === 'open' || auction.status === 'extended';
}

/** Abbreviate a Bitcoin address for compact display. */
export function shortAddr(addr: string): string {
  return addr.length <= 14 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/** Render sats as a grouped integer string, e.g. `1,234,567`. */
export function fmtSats(sats: number): string {
  return Math.round(sats).toLocaleString('en-US');
}

/**
 * Estimate the work `sats` buys at `hashPrice` (sats per petahash-day),
 * e.g. `≈ 1.25 PHd`. Null when there is no usable price.
 */
export function fmtPhd(sats: number, hashPrice: number): string | null {
  if (hashPrice <= 0) return null;
  const phd = sats / hashPrice;
  if (phd <= 0) return null;
  if (phd < 0.0001) return '< 0.0001 PHd';
  const digits = phd >= 100 ? 0 : phd >= 10 ? 1 : phd >= 1 ? 2 : phd >= 0.01 ? 3 : 4;
  return `≈ ${phd.toFixed(digits)} PHd`;
}

/** Relative time for a unix-seconds value, e.g. `5m ago`; falls back to fmtTime beyond 30 days. */
export function fmtTimeAgo(unixSecs: number): string {
  const secs = Math.floor(Date.now() / 1000) - unixSecs;
  if (secs < 60) return 'just now';
  const minutes = Math.floor(secs / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtTime(unixSecs);
}

/** Compact absolute timestamp for a unix-seconds value, e.g. `Oct 12, 14:03`. */
export function fmtTime(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Render a countdown from `remaining` seconds as `Hh Mm Ss` (or "ended"). */
export function fmtCountdown(remaining: number): string {
  if (remaining <= 0) return 'ended';
  const secs = Math.floor(remaining);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
