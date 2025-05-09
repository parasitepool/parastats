# Pool Stats Collector

This component collects mining pool statistics every minute and stores them in an SQLite database for historical analysis.

## How It Works

The collector:
- Fetches pool statistics from the Parasite pool status endpoint
- Stores the data in an SQLite database
- Runs on a cron schedule (every minute)
- Automatically purges old data (configurable, default is 30 days)

## Database Structure

The data is stored in an SQLite database at `data/pool-stats.db` with the following schema:

```sql
CREATE TABLE pool_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,  -- Unix timestamp
  runtime INTEGER NOT NULL,
  users INTEGER NOT NULL,
  workers INTEGER NOT NULL,
  idle INTEGER NOT NULL,
  disconnected INTEGER NOT NULL,
  hashrate1m TEXT NOT NULL,
  hashrate5m TEXT NOT NULL,
  hashrate15m TEXT NOT NULL,
  hashrate1hr TEXT NOT NULL,
  hashrate6hr TEXT NOT NULL,
  hashrate1d TEXT NOT NULL,
  hashrate7d TEXT NOT NULL
)
```

## Running the Collector

### Development Environment

To run the collector in development:

```bash
pnpm collect-stats
```

### Production Environment

In production, you'll want to run this as a background process or service.

Example using PM2:

```bash
# Install PM2 if not already installed
npm install -g pm2

# Start the collector
pm2 start "pnpm collect-stats" --name "parasite-stats-collector"

# Save the PM2 config
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

## API Endpoints

The historical data can be accessed via the `/api/pool-stats/historical` endpoint with the following query parameters:

- `period`: Time range to fetch (1h, 6h, 24h, 7d, 30d)
- `interval`: Data aggregation interval (1m, 5m, 15m, 30m, 1h, raw)

Example: `/api/pool-stats/historical?period=24h&interval=15m`

## Development Notes

- The collector uses Node.js file system features, so it must run in the Node.js runtime, not the Edge Runtime
- All API routes use `export const runtime = 'nodejs'` to ensure they use the Node.js runtime
- The collector script runs independently from the Next.js server
