import { getDb } from './db';

export type StratumCollectorState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'stopped';

export type StratumStatusState = StratumCollectorState | 'offline' | 'unknown';

export interface PersistedStratumStatus {
  state: StratumCollectorState;
  host: string;
  port: number;
  connectedAt: number | null;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  reconnectAttempts: number;
  lastError: string | null;
  resolvedAddress: string | null;
  updatedAt: number;
}

export interface StratumStatus {
  state: StratumStatusState;
  host: string | null;
  port: number | null;
  connectedAt: number | null;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  reconnectAttempts: number;
  lastError: string | null;
  resolvedAddress: string | null;
  updatedAt: number | null;
  collectorOnline: boolean;
  lastNotificationAt: number | null;
  notificationAgeSeconds: number | null;
  heartbeatAgeSeconds: number | null;
  isStale: boolean;
  staleAfterSeconds: number;
}

export const STRATUM_HEARTBEAT_INTERVAL_SECONDS = 30;
export const STRATUM_HEARTBEAT_STALE_SECONDS = 90;
export const STRATUM_NOTIFICATION_STALE_SECONDS = 60;

interface StratumStatusRow {
  state: StratumCollectorState;
  host: string;
  port: number;
  connected_at: number | null;
  last_attempt_at: number | null;
  next_retry_at: number | null;
  reconnect_attempts: number;
  last_error: string | null;
  resolved_address: string | null;
  updated_at: number;
}

export function writeStratumStatus(status: PersistedStratumStatus): void {
  try {
    getDb().prepare(`
      INSERT INTO stratum_collector_status (
        id, state, host, port, connected_at, last_attempt_at,
        next_retry_at, reconnect_attempts, last_error, resolved_address, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state = excluded.state,
        host = excluded.host,
        port = excluded.port,
        connected_at = excluded.connected_at,
        last_attempt_at = excluded.last_attempt_at,
        next_retry_at = excluded.next_retry_at,
        reconnect_attempts = excluded.reconnect_attempts,
        last_error = excluded.last_error,
        resolved_address = excluded.resolved_address,
        updated_at = excluded.updated_at
    `).run(
      status.state,
      status.host,
      status.port,
      status.connectedAt,
      status.lastAttemptAt,
      status.nextRetryAt,
      status.reconnectAttempts,
      status.lastError,
      status.resolvedAddress,
      status.updatedAt,
    );
  } catch (error) {
    console.error('Error writing stratum status:', error);
  }
}

export function readStratumStatus(): PersistedStratumStatus | null {
  const row = getDb().prepare(`
    SELECT state, host, port, connected_at, last_attempt_at, next_retry_at,
           reconnect_attempts, last_error, resolved_address, updated_at
    FROM stratum_collector_status
    WHERE id = 1
  `).get() as StratumStatusRow | undefined;

  if (!row) return null;

  return {
    state: row.state,
    host: row.host,
    port: row.port,
    connectedAt: row.connected_at,
    lastAttemptAt: row.last_attempt_at,
    nextRetryAt: row.next_retry_at,
    reconnectAttempts: row.reconnect_attempts,
    lastError: row.last_error,
    resolvedAddress: row.resolved_address,
    updatedAt: row.updated_at,
  };
}

export function readLastNotificationAt(): number | null {
  const row = getDb().prepare(`
    SELECT MAX(timestamp) AS timestamp
    FROM stratum_notifications
    WHERE pool = 'Parasite'
  `).get() as { timestamp: number | null };

  return row.timestamp;
}

export function getStratumStatus(now = Math.floor(Date.now() / 1000)): StratumStatus {
  return deriveStratumStatus(readStratumStatus(), readLastNotificationAt(), now);
}

export function deriveStratumStatus(
  persisted: PersistedStratumStatus | null,
  lastNotificationAt: number | null,
  now = Math.floor(Date.now() / 1000),
): StratumStatus {
  const notificationAgeSeconds = lastNotificationAt === null
    ? null
    : Math.max(0, now - lastNotificationAt);

  if (!persisted) {
    return {
      state: 'unknown',
      host: null,
      port: null,
      connectedAt: null,
      lastAttemptAt: null,
      nextRetryAt: null,
      reconnectAttempts: 0,
      lastError: null,
      resolvedAddress: null,
      updatedAt: null,
      collectorOnline: false,
      lastNotificationAt,
      notificationAgeSeconds,
      heartbeatAgeSeconds: null,
      isStale: true,
      staleAfterSeconds: STRATUM_NOTIFICATION_STALE_SECONDS,
    };
  }

  const heartbeatAgeSeconds = Math.max(0, now - persisted.updatedAt);
  const collectorOnline = heartbeatAgeSeconds <= STRATUM_HEARTBEAT_STALE_SECONDS;
  const state: StratumStatusState = collectorOnline ? persisted.state : 'offline';
  const isStale =
    !collectorOnline ||
    persisted.state !== 'connected' ||
    notificationAgeSeconds === null ||
    notificationAgeSeconds > STRATUM_NOTIFICATION_STALE_SECONDS;

  return {
    ...persisted,
    state,
    collectorOnline,
    lastNotificationAt,
    notificationAgeSeconds,
    heartbeatAgeSeconds,
    isStale,
    staleAfterSeconds: STRATUM_NOTIFICATION_STALE_SECONDS,
  };
}
