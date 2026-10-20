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
  accepted_shares: number;
  rejected_shares: number;
  accepted_work: number;
  rejected_work: number;
  delivered_hash_days: number;
  best_share: number | null;
  last_share: number | null;
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
  best_share: number | null;
  last_share: number | null;
}

export interface Connects1h {
  total: number;
  sessions: number;
  probes: number;
  rejects: number;
  pending: number;
}

export interface Disconnects1h {
  total: number;
  client: number;
  server: number;
  trim: number;
  rejects: number;
}

export interface UpstreamStats extends RealtimeStats {
  users: number;
  workers: number;
  orders: number;
  pending: number;
  disconnected: number;
  disconnects_1h: number;
  totals: UpstreamTotals;
}

export interface DownstreamStats extends RealtimeStats {
  users: number;
  workers: number;
  sessions: number;
  idle: number;
  disconnected: number;
  connects_1h: Connects1h;
  disconnects_1h: Disconnects1h;
  totals: DownstreamTotals;
}

export interface WalletInfo {
  synced: boolean;
}

export interface RouterStatus {
  uptime_secs: number;
  block_count: number;
  recent_blocks: string[];
  hash_price: number;
  hash_value: number;
  difficulty_multiplier: number;
  total_capacity_hash_days: number;
  used_capacity_hash_days: number;
  halt: boolean;
  boost: boolean;
  wallet: WalletInfo;
  deficit_hashrate: number;
  surplus_hashrate: number;
  starving_order_count: number;
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
  remote_address: string;
  stats: MiningStats;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  review: Review;
  endpoint: string;
  username: string;
  /** Sink orders have no work target (null); bucket orders always do. */
  requested_hash_days: number | null;
  hashrate: number;
  delivered_hash_days: number;
  best_share: number | null;
}

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  review: Review;
  upstream_target: UpstreamTarget;
  upstream_address: string | null;
  upstream_disconnects_total: number;
  requested_hash_days: number | null;
  hash_price: number | null;
  payment_address: string | null;
  payment_amount: number | null;
  txids: string[];
  created_at: number;
  created_at_height: number | null;
  upstream: MiningStats;
  downstream: MiningStats;
  sessions: SessionDetail[];
}

/** A bucket order names its work (hash_days) and bid (hash_price, sats/PHd). */
export interface OrderRequest {
  upstream_target: UpstreamTarget;
  hash_days: number;
  hash_price: number;
}

export interface OrderResponse {
  order_id: number;
  payment_address: string;
  payment_amount: number;
  hash_price: number;
}

/** A used-capacity sample recorded by the local router capacity collector. */
export interface CapacityPoint {
  /** Unix epoch seconds. */
  timestamp: number;
  used_hash_days: number;
}

/** A bucket order's creation time, assembled server-side from order details. */
export interface OrderTimelinePoint {
  id: number;
  status: OrderStatus;
  /** Unix epoch seconds. */
  created_at: number;
  requested_hash_days: number;
  /** Live values from the order summary (not cached). */
  hashrate: number;
  best_share: number | null;
}
