export type OrderStatus =
  | 'pending'
  | 'in_mempool'
  | 'active'
  | 'fulfilled'
  | 'cancelled'
  | 'disconnected'
  | 'expired';

export type Review = 'clean' | 'flagged' | 'cleared';

export interface MiningStats {
  hashrate_1m: number;
  hashrate_5m: number;
  hashrate_15m: number;
  hashrate_1hr: number;
  hashrate_6hr: number;
  hashrate_1d: number;
  hashrate_7d: number;
  sps_1m: number;
  sps_5m: number;
  sps_15m: number;
  sps_1hr: number;
  best_share: number | null;
  last_share: number | null;
  accepted_shares: number;
  rejected_shares: number;
  accepted_work: number;
  rejected_work: number;
  delivered_hash_days: number;
}

export interface UpstreamTarget {
  endpoint: string;
  username: string;
  password: string | null;
}

export interface UpstreamTotals {
  users: number;
  orders: number;
  accepted_shares: number;
  rejected_shares: number;
  accepted_work: number;
  rejected_work: number;
  delivered_hash_days: number;
  best_share: number | null;
  last_share: number | null;
}

export interface DownstreamTotals {
  users: number;
  workers: number;
  accepted_shares: number;
  rejected_shares: number;
  accepted_work: number;
  rejected_work: number;
  delivered_hash_days: number;
  best_share: number | null;
  last_share: number | null;
}

interface RealtimeStats {
  hashrate_1m: number;
  hashrate_5m: number;
  hashrate_15m: number;
  hashrate_1hr: number;
  hashrate_6hr: number;
  hashrate_1d: number;
  hashrate_7d: number;
  sps_1m: number;
  sps_5m: number;
  sps_15m: number;
  sps_1hr: number;
  accepted_shares: number;
  rejected_shares: number;
  accepted_work: number;
  rejected_work: number;
}

export interface UpstreamStats extends RealtimeStats {
  users: number;
  workers: number;
  orders: number;
  pending: number;
  disconnected: number;
  totals: UpstreamTotals;
}

export interface DownstreamStats extends RealtimeStats {
  users: number;
  workers: number;
  sessions: number;
  idle: number;
  disconnected: number;
  totals: DownstreamTotals;
}

export interface OrphanReceipt {
  derivation_index: number;
  address: string;
  amount: number;
  first_seen_height: number;
}

export interface WalletInfo {
  synced: boolean;
  orphan_receipts: OrphanReceipt[];
}

export interface IntentClaimCounts {
  enonce1: number;
  ip: number;
}

export interface PlacementCounts {
  intent: number;
  resumed: number;
  redirected: number;
  estimated: number;
  blind: number;
}

export interface RoutingInfo {
  sessions_trimmed_1h: number;
  intents_created_1h: number;
  intents_expired_1h: number;
  intent_claims_1h: IntentClaimCounts;
  placements_1h: PlacementCounts;
  deficit_hashrate: number;
  bucket_order_count: number;
  sink_order_count: number;
  starving_order_count: number;
}

export interface RouterStatus {
  uptime_secs: number;
  block_count: number;
  recent_blocks: string[];
  hash_price: number;
  premium_percent: number;
  total_capacity_hash_days: number;
  used_capacity_hash_days: number;
  halt: boolean;
  boost: boolean;
  wallet: WalletInfo;
  routing: RoutingInfo;
  upstream: UpstreamStats;
  downstream: DownstreamStats;
  git_commit: string;
}

export interface SessionDetail {
  id: number;
  order_id: number;
  address: string;
  worker_name: string;
  username: string;
  enonce1: string;
  version_mask: string | null;
  stats: MiningStats;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  review: Review;
  endpoint: string;
  username: string;
  requested_hash_days: number | null;
  /** Open orders are priced when paid; `requested_hash_days` is 0 until then. */
  open?: boolean;
  hashrate: number;
  delivered_hash_days: number;
  best_share: number | null;
}

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  review: Review;
  upstream_target: UpstreamTarget;
  requested_hash_days: number | null;
  hash_price: number | null;
  payment_address: string | null;
  payment_amount: number | null;
  /** Open orders are priced when paid; `requested_hash_days` is 0 until then. */
  open?: boolean;
  payment_deadline_height?: number | null;
  txids: string[];
  created_at: number;
  created_at_height: number | null;
  upstream: MiningStats;
  downstream: MiningStats;
  sessions: SessionDetail[];
}

/**
 * A fixed order names its work and price and is paid exactly. An open order
 * (no `hash_days`/`hash_price`) gets an address that accepts any amount for
 * `payment_deadline_blocks`; the router prices the work when the payment
 * confirms. Auction payouts use the open form.
 */
export interface OrderRequest {
  upstream_target: UpstreamTarget;
  hash_days?: number;
  hash_price?: number;
  payment_deadline_blocks?: number;
}

export interface OrderResponse {
  order_id: number;
  payment_address: string;
  payment_amount: number;
  hash_price: number;
  open?: boolean;
  payment_deadline_height?: number;
}
