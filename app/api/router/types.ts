export type OrderStatus =
  | 'pending'
  | 'in_mempool'
  | 'active'
  | 'fulfilled'
  | 'cancelled'
  | 'disconnected'
  | 'expired';

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
  hash_days: number;
}

export interface UpstreamTarget {
  endpoint: string;
  username: string;
  password: string | null;
}

export interface DownstreamInfo {
  user_count: number;
  worker_count: number;
  session_count: number;
  disconnected_count: number;
  idle_count: number;
  stats: MiningStats;
}

export interface RouterStatus {
  uptime_secs: number;
  hash_price: number;
  capacity_work: number;
  available_work: number;
  active_order_count: number;
  wallet_synced: boolean;
  halt: boolean;
  boost: boolean;
  upstream: MiningStats;
  downstream: DownstreamInfo;
}

export interface SessionDetail {
  id: string;
  order_id: number;
  address: string;
  worker_name: string;
  username: string;
  enonce1: string;
  version_mask: number | null;
  stats: MiningStats;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  endpoint: string;
  username: string;
  requested_hash_days: number | null;
  hashrate: number;
  delivered_hash_days: number;
  best_share: number | null;
}

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  upstream_target: UpstreamTarget;
  requested_hash_days: number | null;
  hash_price: number | null;
  payment_address: string | null;
  payment_amount: number | null;
  created_at: number;
  created_at_height: number;
  upstream: MiningStats;
  downstream: MiningStats;
  sessions: SessionDetail[];
}

export interface PublicOrderSummary {
  id: number;
  status: OrderStatus;
  address: string;
  requested_hash_days: number | null;
  hashrate: number;
  delivered_hash_days: number;
  best_share: number | null;
}

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
