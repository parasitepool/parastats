export type OrderStatus =
  | 'pending'
  | 'active'
  | 'fulfilled'
  | 'cancelled'
  | 'disconnected'
  | 'expired'
  | 'paid_late';

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

export interface UpstreamInfo {
  endpoint: string;
  connected: boolean;
  ping_ms: number;
  difficulty: number;
  username: string;
  enonce1: string;
  enonce2_size: number;
  version_mask: number | null;
  stats: MiningStats;
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
  capacity_hashrate: number;
  available_hashrate: number;
  bucket_order_count: number;
  sink_order_count: number;
  upstream: MiningStats;
  downstream: DownstreamInfo;
}

export interface SessionDetail {
  id: string;
  upstream_id: number;
  address: string;
  worker_name: string;
  username: string;
  enonce1: string;
  version_mask: number | null;
  stats: MiningStats;
}

export type OrderKind = 'sink' | { bucket: number };

export interface OrderDetail {
  id: number;
  status: OrderStatus;
  upstream_target: UpstreamTarget;
  kind: OrderKind;
  payment_address: string;
  payment_amount: number;
  upstream: UpstreamInfo | null;
  downstream: MiningStats;
  sessions: SessionDetail[];
}

export interface OrderRequest {
  upstream_target: UpstreamTarget;
  hashdays: number;
  price: number;
}

export interface OrderResponse {
  order_id: number;
  payment_address: string;
  payment_amount: number;
}
