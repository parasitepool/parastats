import net from 'net';
import { getDb } from './db';

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
  private messageId: number = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnecting: boolean = false;
  private isDestroyed: boolean = false;
  private messageBuffer: string = '';
  private extranonce1: string | null = null;
  private extranonce2Size: number | null = null;
  private notificationCount: number = 0;
  private readonly CLEANUP_INTERVAL = 50; // Run cleanup every 50 notifications
  private readonly MAX_NOTIFICATIONS = 100; // Keep only latest 100 notifications

  constructor(
    private host: string = 'parasite.wtf',
    private port: number = 42069
  ) {}

  async connect(): Promise<void> {
    if (this.isConnecting || this.isDestroyed) return;

    this.isConnecting = true;
    console.log(`Attempting to connect to ${this.host}:${this.port}...`);

    try {
      this.socket = new net.Socket();
      
      // Set up socket event handlers
      this.socket.on('connect', () => {
        console.log('Connected to Parasite stratum pool');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.subscribe();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('error', (error) => {
        console.error('Stratum socket error:', error);
        this.handleDisconnect();
      });

      this.socket.on('close', () => {
        console.log('Stratum connection closed');
        this.handleDisconnect();
      });

      this.socket.on('end', () => {
        console.log('Stratum connection ended');
        this.handleDisconnect();
      });

      // Connect with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket!.connect(this.port, this.host, () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('Failed to connect to stratum pool:', error);
      this.isConnecting = false;
      this.handleDisconnect();
      throw error;
    }
  }

  private handleData(data: Buffer | string): void {
    try {
      // Add new data to buffer
      this.messageBuffer += typeof data === 'string' ? data : data.toString();
      
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
    } else if (message.method === 'mining.set_difficulty') {
      // Keep difficulty changes quiet unless there's an issue
    } else if (message.id && message.result !== undefined) {
      // Handle method responses
      
      // If this is the subscription response (ID 1), capture extranonce values
      if (message.id === 1 && message.result) {
        console.log('📋 Connected and subscribed to Parasite stratum pool');
        
        // Extract extranonce1 and extranonce2_size from subscription result
        // Result format: [[["mining.set_difficulty", "subscription_id"], ["mining.notify", "subscription_id"]], "extranonce1", extranonce2_size]
        if (Array.isArray(message.result) && message.result.length >= 3) {
          this.extranonce1 = message.result[1];
          this.extranonce2Size = message.result[2];
          console.log(`🔧 Extranonce1: ${this.extranonce1}, Extranonce2 size: ${this.extranonce2Size}`);
        }
        
        this.handleSubscriptionResponse();
      } else if (message.id === 2 && message.result === true) {
        console.log('🔐 Authorization successful - receiving mining notifications');
      }
    } else if (message.error) {
      console.error('❌ Stratum error:', message.error);
    }
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

    // Send mining.subscribe with more standard parameters
    const subscribeMsg = {
      id: this.messageId++,
      method: "mining.subscribe",
      params: ["parastats-collector/1.0"]
    };

    this.sendMessage(subscribeMsg);
    // Wait for subscription response before trying to authorize
  }

  private handleSubscriptionResponse(): void {
    // Use proper Parasite pool credentials: Bitcoin address + "x" password
    const authorizeMsg = {
      id: this.messageId++,
      method: "mining.authorize",
      params: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "x"]  // Using Satoshi's address as example
    };
    
    this.sendMessage(authorizeMsg);
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

  private handleDisconnect(): void {
    if (this.isDestroyed) return;

    this.isConnecting = false;
    this.messageBuffer = ''; // Clear message buffer on disconnect
    this.notificationCount = 0; // Reset notification counter on disconnect
    
    if (this.socket) {
      this.socket.removeAllListeners();
      if (!this.socket.destroyed) {
        this.socket.destroy();
      }
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Implement exponential backoff for reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Giving up.');
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.messageBuffer = ''; // Clear message buffer
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      if (!this.socket.destroyed) {
        this.socket.destroy();
      }
      this.socket = null;
    }
  }
}

// Singleton instance
let stratumCollector: StratumCollector | null = null;

export function startStratumCollector(): StratumCollector {
  if (stratumCollector) {
    return stratumCollector;
  }

  stratumCollector = new StratumCollector();
  
  stratumCollector.connect().catch(error => {
    console.error('Failed to start stratum collector:', error);
  });

  return stratumCollector;
}

export function stopStratumCollector(): void {
  if (stratumCollector) {
    stratumCollector.destroy();
    stratumCollector = null;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down stratum collector...');
  stopStratumCollector();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down stratum collector...');
  stopStratumCollector();
  process.exit(0);
});
