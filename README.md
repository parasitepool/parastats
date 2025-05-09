# Parastats

A mining pool frontend for parasite

## Features

- **Real-time Statistics**: Monitor pool and individual miner statistics with automatic updates
- **Historical Data**: Track performance over time with detailed charts
- **User Dashboard**: Personal dashboard for miners
- **Automated Data Collection**: Background service collecting pool statistics every minute

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
