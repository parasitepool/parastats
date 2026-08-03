// Canonical badge payload served by the para server `GET /badges/{address}`
// endpoint. Kept dependency-free so both server code (collector, API route) and
// client components (BadgeDisplay) can import it without pulling in server-only
// modules. Mirrors the Rust structs in
// para/src/subcommand/server/badges.rs.

export const BLOCK_BADGE_ID = 'block';
export const BLOCK_WINNER_BADGE_ID = 'block_winner';
export const LOYALTY_BADGE_ID = 'loyalty';
export const REFINERY_BADGE_ID = 'refinery';
export const DISPENSER_BADGE_ID = 'dispenser';
export const BRAVOCADO_BADGE_ID = 'bravocado';
export const MINER_BADGE_ID = 'miner';
export const AUCTION_WINNER_BADGE_ID = 'auction_winner';

/** Blocks of participation per loyalty instance (mirrors para's LOYALTY_BLOCKS_PER_INSTANCE). */
export const LOYALTY_BLOCKS_PER_INSTANCE = 21_000;

export interface BadgeInstance {
  blockheight: number;
}

export interface BadgeBucket {
  count: number;
}

export interface BadgeType {
  /** Stacking policy, e.g. "unique_then_bucket". */
  kind: string;
  /** Individually-earned, non-stacking instances (earliest few). */
  unique: BadgeInstance[];
  /** Everything beyond the unique cap, collapsed into a stacking count. */
  bucket: BadgeBucket;
  /** Total earned across unique + bucket. */
  total: number;
}

export interface BadgesPayload {
  version: number;
  computed_at: string;
  /** Max found-block height at compute time (cache-invalidation fingerprint). */
  source_tip?: number;
  /** Number of rows in `blocks` at compute time (paired with source_tip). */
  source_blocks?: number;
  /** Keyed by badge id (e.g. "block"). */
  types: Record<string, BadgeType>;
}
