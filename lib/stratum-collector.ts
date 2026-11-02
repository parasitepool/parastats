import net from 'net';
import { getDb } from './db';
import { triggerDelayedCollection, getCurrentBlockHeight } from './highest-diff-collector';
import { triggerRoundsSync } from './rounds-collector';
import { getStratumReconnectDelay } from './stratum-reconnect';
import {
  STRATUM_HEARTBEAT_INTERVAL_SECONDS,
  writeStratumStatus,
  type StratumCollectorState,
} from './stratum-status';

interface StratumMessage {
  id?: number;
  method?: string;
  params?: unknown[];
  result?: unknown;
  error?: unknown;
}

interface StratumNotificationData {
  notification_id: string;
  timestamp: number;
  pool: string;
  job_id: string;
  prev_block_hash: string;
  coinbase1: string;
  coinbase2: string;
  merkle_branches: string;
  version: string;
  n_bits: string;
  n_time: string;
  clean_jobs: number;
  extranonce1: string | null;
  extranonce2_size: number | null;
  raw_message: string;
  created_at: number;
}

class StratumCollector {
  private socket: net.Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private handshakeTimer: NodeJS.Timeout | null = null;
  private messageId: number = 1;
  private subscribeRequestId: number | null = null;
  private authorizeRequestId: number | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private started: boolean = false;
  private messageBuffer: string = '';
  private extranonce1: string | null = null;
  private extranonce2Size: number | null = null;
  private notificationCount: number = 0;
  private state: StratumCollectorState = 'connecting';
  private connectedAt: number | null = null;
  private lastAttemptAt: number | null = null;
  private nextRetryAt: number | null = null;
  private lastError: string | null = null;
  private lastResolvedAddress: string | null = null;
  private lastNotificationAt: number | null = null;

  private readonly CONNECT_TIMEOUT_MS = 10_000;
  private readonly HANDSHAKE_TIMEOUT_MS = 15_000;
  private readonly IDLE_TIMEOUT_MS = 60_000;
  private readonly NOTIFICATION_WATCHDOG_SECONDS = 120;
  private readonly CLEANUP_INTERVAL = 50; // Run cleanup every 50 notifications
  private readonly MAX_NOTIFICATIONS = 100; // Keep only latest 100 notifications
  private readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer size

  constructor(
    private host: string = process.env.STRATUM_HOST || 'parasite.wtf',
    private port: number = Number(process.env.STRATUM_PORT || 42069),
  ) {}

  public start(): void {
    if (this.started) return;

    this.started = true;
    this.startHeartbeat();
    this.connect();
  }

  private connect(): void {
    if (this.isDestroyed || this.isConnecting) return;

    this.clearReconnectTimer();
    this.isConnecting = true;
    this.state = 'connecting';
    this.lastAttemptAt = Math.floor(Date.now() / 1000);
    this.nextRetryAt = null;
    this.lastError = null;
    this.connectedAt = null;
    this.messageBuffer = '';
    this.messageId = 1;
    this.subscribeRequestId = null;
    this.authorizeRequestId = null;
    this.extranonce1 = null;
    this.extranonce2Size = null;
    this.lastResolvedAddress = null;
    this.lastNotificationAt = null;
    this.writeStatus();

    const socket = new net.Socket();
    this.socket = socket;

    socket.setKeepAlive(true, 30_000);
    socket.setNoDelay(true);
    socket.setTimeout(this.IDLE_TIMEOUT_MS, () => {
      if (this.socket !== socket) return;
      this.lastError = 'Stratum connection idle timeout';
      this.disconnect(socket, 'idle timeout');
    });

    socket.once('connect', () => {
      if (this.socket !== socket) return;

      this.isConnecting = false;
      this.clearConnectTimer();
      if (socket.remoteAddress) {
        this.lastResolvedAddress = socket.remoteAddress.replace(/^::ffff:/, '');
      }
      this.writeStatus();
      this.startHandshakeTimeout(socket);
      this.subscribe();
    });

    socket.once('error', (error) => {
      if (this.socket !== socket) return;
      console.error('Stratum socket error:', error);
      this.lastError = StratumCollector.errorMessage(error);
      this.disconnect(socket, 'socket error');
    });

    socket.once('close', () => {
      if (this.socket !== socket) return;
      this.disconnect(socket, 'connection closed');
    });

    socket.once('end', () => {
      if (this.socket !== socket) return;
      this.disconnect(socket, 'connection ended');
    });

    socket.on('data', (data) => {
      if (this.socket !== socket) return;
      this.handleData(data);
    });

    socket.on('lookup', (error, address, family) => {
      if (this.socket !== socket) return;
      if (error) {
        console.error('Stratum DNS lookup failed:', error);
        return;
      }
      if (address) {
        this.lastResolvedAddress = family === 6 ? `[${address}]` : address;
        this.writeStatus();
      }
    });

    this.connectTimer = setTimeout(() => {
      if (this.socket !== socket) return;
      this.lastError = 'Stratum connection timed out';
      this.disconnect(socket, 'connect timeout');
    }, this.CONNECT_TIMEOUT_MS);

    try {
      socket.connect({ host: this.host, port: this.port });
    } catch (error) {
      this.lastError = StratumCollector.errorMessage(error);
      this.disconnect(socket, 'connect error');
    }
  }

  private startHandshakeTimeout(socket: net.Socket): void {
    this.clearHandshakeTimer();
    this.handshakeTimer = setTimeout(() => {
      if (this.socket !== socket) return;
      this.lastError = 'Stratum handshake timed out';
      this.disconnect(socket, 'handshake timeout');
    }, this.HANDSHAKE_TIMEOUT_MS);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.writeStatus();
      this.checkNotificationWatchdog();
    }, STRATUM_HEARTBEAT_INTERVAL_SECONDS * 1000);
  }

  private checkNotificationWatchdog(): void {
    if (this.state !== 'connected' || !this.socket) return;

    const lastTemplateAt = this.lastNotificationAt ?? this.connectedAt;
    if (lastTemplateAt === null) return;

    const ageSeconds = Math.floor(Date.now() / 1000) - lastTemplateAt;
    if (ageSeconds > this.NOTIFICATION_WATCHDOG_SECONDS) {
      this.lastError = `No block template received for ${ageSeconds}s`;
      this.disconnect(this.socket, 'notification timeout');
    }
  }

  private writeStatus(): void {
    writeStratumStatus({
      state: this.state,
      host: this.host,
      port: this.port,
      connectedAt: this.connectedAt,
      lastAttemptAt: this.lastAttemptAt,
      nextRetryAt: this.nextRetryAt,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      resolvedAddress: this.lastResolvedAddress,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  }

  private disconnect(socket: net.Socket, reason: string): void {
    if (this.socket !== socket) {
      socket.removeAllListeners();
      socket.destroy();
      return;
    }

    this.clearConnectTimer();
    this.clearHandshakeTimer();
    this.socket = null;
    this.isConnecting = false;
    this.messageBuffer = '';
    this.subscribeRequestId = null;
    this.authorizeRequestId = null;
    this.extranonce1 = null;
    this.extranonce2Size = null;
    this.connectedAt = null;
    socket.removeAllListeners();
    socket.destroy();

    if (this.isDestroyed) return;

    if (!this.lastError) {
      this.lastError = reason === 'connection closed' || reason === 'connection ended'
        ? 'Connection closed by upstream'
        : reason;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    this.clearReconnectTimer();
    const delay = getStratumReconnectDelay(this.reconnectAttempts);
    this.state = 'reconnecting';
    this.nextRetryAt = Math.floor(Date.now() / 1000) + Math.ceil(delay / 1000);
    this.writeStatus();

    console.log(
      `Reconnecting to ${this.host}:${this.port} in ${delay}ms ` +
      `(attempt ${this.reconnectAttempts + 1})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleData(data: Buffer | string): void {
    try {
      // Add new data to buffer
      this.messageBuffer += typeof data === 'string' ? data : data.toString();

      // Guard against unbounded buffer growth from malformed data
      if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
        console.warn(`Stratum message buffer exceeded ${this.MAX_BUFFER_SIZE} bytes, clearing`);
        this.messageBuffer = '';
        return;
      }

      // Process complete messages (separated by newlines)
      const lines = this.messageBuffer.split('\n');

      // Keep the last incomplete line in the buffer
      this.messageBuffer = lines.pop() || '';

      // Process each complete line
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: StratumMessage = JSON.parse(line.trim());
            this.handleMessage(message);
          } catch (parseError) {
            console.error('Failed to parse stratum message:', parseError, 'Raw:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));
          }
        }
      }
    } catch (error) {
      console.error('Error handling stratum data:', error);
    }
  }

  private handleMessage(message: StratumMessage): void {
    if (message.method === 'mining.notify') {
      this.processNotification(message);
      return;
    }

    if (message.method === 'mining.set_difficulty') {
      // Keep difficulty changes quiet unless there's an issue
      return;
    }

    if (typeof message.id === 'number' && message.id === this.subscribeRequestId) {
      this.handleSubscribeResponse(message);
      return;
    }

    if (typeof message.id === 'number' && message.id === this.authorizeRequestId) {
      this.handleAuthorizeResponse(message);
      return;
    }

    if (message.error) {
      console.error('❌ Stratum error:', message.error);
    }
  }

  private handleSubscribeResponse(message: StratumMessage): void {
    this.subscribeRequestId = null;

    if (message.error) {
      this.lastError = `mining.subscribe failed: ${JSON.stringify(message.error)}`.slice(0, 500);
      if (this.socket) this.disconnect(this.socket, 'subscribe error');
      return;
    }

    // Result format: [[["mining.set_difficulty", "subscription_id"], ...], "extranonce1", extranonce2_size]
    if (Array.isArray(message.result) && message.result.length >= 3) {
      this.extranonce1 = typeof message.result[1] === 'string' ? message.result[1] : null;
      this.extranonce2Size = typeof message.result[2] === 'number' ? message.result[2] : null;
      console.log(`🔧 Extranonce1: ${this.extranonce1}, Extranonce2 size: ${this.extranonce2Size}`);
    }

    this.clearHandshakeTimer();
    this.state = 'connected';
    this.connectedAt = Math.floor(Date.now() / 1000);
    this.nextRetryAt = null;
    this.lastError = null;
    this.writeStatus();
    console.log(`📋 Connected and subscribed to ${this.host}:${this.port}`);

    this.sendAuthorization();
  }

  private handleAuthorizeResponse(message: StratumMessage): void {
    this.authorizeRequestId = null;

    if (message.error) {
      console.error('❌ Stratum authorization failed:', message.error);
      this.lastError = `mining.authorize failed: ${JSON.stringify(message.error)}`.slice(0, 500);
      this.writeStatus();
      return;
    }

    if (message.result !== true) {
      console.error('❌ Stratum authorization was not accepted:', message.result);
      this.lastError = 'mining.authorize was not accepted';
      this.writeStatus();
      return;
    }

    console.log('🔐 Authorization successful - receiving mining notifications');
  }

  private processNotification(message: StratumMessage): void {
    try {
      if (!message.params || message.params.length < 9) {
        console.error('Invalid mining.notify message:', message);
        return;
      }

      const [
        jobId,
        prevBlockHash,
        coinbase1,
        coinbase2,
        merkleBranches,
        version,
        nBits,
        nTime,
        cleanJobs
      ] = message.params;

      const now = Math.floor(Date.now() / 1000);
      const notificationId = `${now}_${String(jobId)}`;
      this.lastNotificationAt = now;
      // A delivered template proves the connection is healthy; only then
      // reset the reconnect backoff. Subscribing alone is not enough because
      // an unhealthy upstream can accept, subscribe, and immediately close.
      this.reconnectAttempts = 0;

      const notification: StratumNotificationData = {
        notification_id: notificationId,
        timestamp: now,
        pool: 'Parasite',
        job_id: String(jobId),
        prev_block_hash: String(prevBlockHash),
        coinbase1: String(coinbase1),
        coinbase2: String(coinbase2),
        merkle_branches: JSON.stringify(merkleBranches),
        version: String(version),
        n_bits: String(nBits),
        n_time: String(nTime),
        clean_jobs: cleanJobs ? 1 : 0,
        extranonce1: this.extranonce1,
        extranonce2_size: this.extranonce2Size,
        raw_message: JSON.stringify(message),
        created_at: now
      };

      this.storeNotification(notification);
      // Log only on clean job notifications (new blocks) to reduce noise
      if (cleanJobs) {
        console.log(`🎯 New block template: Job ${jobId} (${new Date(now * 1000).toISOString()})`);

        // Trigger highest diff collection for the previous block
        // The new block means the previous block is now complete
        this.triggerHighestDiffCollection();

        // Trigger rounds re-sync in case a new round was found
        triggerRoundsSync();
      }

    } catch (error) {
      console.error('Error processing stratum notification:', error);
    }
  }

  private storeNotification(notification: StratumNotificationData): void {
    try {
      const db = getDb();

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO stratum_notifications (
          notification_id, timestamp, pool, job_id, prev_block_hash,
          coinbase1, coinbase2, merkle_branches, version,
          n_bits, n_time, clean_jobs, extranonce1, extranonce2_size, raw_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        notification.notification_id,
        notification.timestamp,
        notification.pool,
        notification.job_id,
        notification.prev_block_hash,
        notification.coinbase1,
        notification.coinbase2,
        notification.merkle_branches,
        notification.version,
        notification.n_bits,
        notification.n_time,
        notification.clean_jobs,
        notification.extranonce1,
        notification.extranonce2_size,
        notification.raw_message,
        notification.created_at
      );

      // Increment counter and cleanup periodically instead of every insert
      this.notificationCount++;
      if (this.notificationCount % this.CLEANUP_INTERVAL === 0) {
        this.cleanupOldNotifications();
      }

    } catch (error) {
      console.error('Error storing stratum notification:', error);
    }
  }

  private cleanupOldNotifications(): void {
    try {
      const db = getDb();

      // Delete all notifications except the latest number defined in MAX_NOTIFICATIONS
      const result = db.prepare(`
        DELETE FROM stratum_notifications
        WHERE id <= (
          SELECT COALESCE(MAX(id) - ?, 0)
          FROM stratum_notifications
        )
      `).run(this.MAX_NOTIFICATIONS);

      if (result.changes > 0) {
        console.log(`🧹 Cleaned up ${result.changes} old stratum notifications`);
      }
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  private subscribe(): void {
    if (!this.socket) return;

    const id = this.messageId++;
    this.subscribeRequestId = id;
    this.sendMessage({
      id,
      method: 'mining.subscribe',
      params: ['parastats-collector/1.0'],
    });
  }

  private sendAuthorization(): void {
    if (!this.socket) return;

    const id = this.messageId++;
    this.authorizeRequestId = id;
    this.sendMessage({
      id,
      method: 'mining.authorize',
      params: ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'x'],
    });
  }

  private sendMessage(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.destroyed) return;

    try {
      const messageStr = JSON.stringify(message) + '\n';
      this.socket.write(messageStr);
    } catch (error) {
      console.error('Error sending stratum message:', error);
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.clearReconnectTimer();
    this.clearConnectTimer();
    this.clearHandshakeTimer();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.removeAllListeners();
      socket.destroy();
    }

    this.state = 'stopped';
    this.connectedAt = null;
    this.nextRetryAt = null;
    this.lastError = null;
    this.writeStatus();
  }

  /**
   * Trigger collection of highest diff for the previous block
   * Called when a new block is detected (clean_jobs=true)
   */
  private triggerHighestDiffCollection(): void {
    // Get current block height and trigger collection for the previous block
    getCurrentBlockHeight()
      .then(currentHeight => {
        // The previous block is now complete, collect its highest diff
        const previousBlock = currentHeight - 1;
        triggerDelayedCollection(previousBlock);
      })
      .catch(error => {
        console.error('Error getting block height for highest diff collection:', error);
      });
  }

  private static errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 500);
  }
}

// Singleton instance
let stratumCollector: StratumCollector | null = null;

export function startStratumCollector(): StratumCollector {
  if (stratumCollector) {
    return stratumCollector;
  }

  stratumCollector = new StratumCollector();
  stratumCollector.start();

  return stratumCollector;
}

export function stopStratumCollector(): void {
  if (stratumCollector) {
    stratumCollector.destroy();
    stratumCollector = null;
  }
}
