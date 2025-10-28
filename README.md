# Parastats

A mining pool frontend for parasite

## Features

- **Real-time Statistics**: Monitor pool and individual miner statistics with automatic updates
- **Historical Data**: Track performance over time with detailed charts
- **User Dashboard**: Personal dashboard for miners
- **Automated Data Collection**: Background service collecting pool and user statistics every minute
- **Stratum Pool Integration**: Real-time connection to Parasite stratum pool for block template notifications
- **Automated Data Retention**: Automatic cleanup of old data (30-day retention) with daily maintenance

## Tech Stack

- **Frontend**: Next.js 15.3 with React 19
- **Styling**: TailwindCSS 4.1
- **Database**: SQLite (via better-sqlite3)
- **Charts**: ECharts 5.6
- **HTTP Client**: Undici with HTTP/2 support for optimized API requests
- **Bitcoin Integration**: @mempool/mempool.js

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

3. Start the stats collector (in a separate terminal):
```bash
pnpm collect-stats
```

This will start:
- **Pool Stats Collector**: Fetches pool statistics every minute
- **User Stats Collector**: Fetches individual miner statistics every minute
- **Stratum Collector**: Connects to the Parasite stratum pool for real-time block template notifications
- **Data Maintenance**: Runs daily cleanup at midnight to purge data older than 30 days

The application will be available at [http://localhost:3000](http://localhost:3000).

## Development

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Create production build
- `pnpm start` - Start production server
- `pnpm lint` - Run linter
- `pnpm lint:fix` - Fix linting issues
- `pnpm collect-stats` - Start the statistics collector

## Project Structure

- `/app` - Next.js application code
  - `/components` - React components
  - `/api` - API routes
  - `/user` - User dashboard
  - `/worker` - Worker dashboard
- `/lib` - Shared utilities and database code
- `/scripts` - Background jobs and utilities
- `/data` - SQLite database and other data files

## Configuration

The stats collector can be configured using environment variables:

### Required
- `API_URL` - URL of server to fetch statistics from (example: https://example.com/api)
- `API_TOKEN` - Bearer access token (example: supersecrettoken)

### Optional

**Stats Collection:**
- `PARASTATS_DATA_DIR` - Database location (default: `./data`)
- `MAX_FAILED_ATTEMPTS` - Failed fetch attempts before deactivating a user (default: `10`)
- `USER_BATCH_SIZE` - Users to process concurrently (default: `500`)
- `FAILED_USER_BACKOFF_MINUTES` - Wait time before retrying failed users (default: `2`)
- `AUTO_DISCOVER_USERS` - Auto-discover and monitor new miners (default: `true`)
- `AUTO_DISCOVER_BATCH_LIMIT` - Max new users to add per cycle (default: `100`)

**HTTP/2 Client:**
- `HTTP2_MAX_CONNECTIONS` - Max concurrent connections per origin (default: `30`)
- `HTTP2_CLIENT_TTL` - Connection lifetime in ms (default: `90000`)
- `HTTP2_CONNECT_TIMEOUT` - Connection timeout in ms (default: `5000`)
- `HTTP2_HEADERS_TIMEOUT` - Response headers timeout in ms (default: `10000`)
- `HTTP2_BODY_TIMEOUT` - Response body timeout in ms (default: `10000`)
- `HTTP2_KEEPALIVE_TIMEOUT` - Keep-alive timeout in ms (default: `60000`)

### Examples

Basic usage:
```bash
API_URL=https://example.com/api API_TOKEN=supersecrettoken pnpm collect-stats
API_URL=https://example.com/api API_TOKEN=supersecrettoken pnpm dev
```

With auto-discovery disabled:
```bash
API_URL=https://example.com/api API_TOKEN=supersecrettoken AUTO_DISCOVER_USERS=false pnpm collect-stats
```

Custom configuration:
```bash
PARASTATS_DATA_DIR=/path/to/data MAX_FAILED_ATTEMPTS=5 pnpm collect-stats
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial 4.0 International License](http://creativecommons.org/licenses/by-nc/4.0/).

This means you are free to:
- Share — copy and redistribute the material in any medium or format
- Adapt — remix, transform, and build upon the material

Under the following terms:
- Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
- NonCommercial — You may not use the material for commercial purposes.
