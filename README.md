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

- `PARASTATS_DATA_DIR` - Database location (default: `./data`)
- `MAX_FAILED_ATTEMPTS` - Number of failed fetch attempts before deactivating a user (default: `10`)
- `USER_BATCH_SIZE` - Number of users to process in parallel (default: `500`)
- `FAILED_USER_BACKOFF_MINUTES` - Minutes to wait before retrying failed users (default: `2`)

Example:
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
