# Stratum Implementation

Real stratum implementation completed for the block template page.

### Core Features
- **Real TCP connection** to pools with auto-reconnection
- **Database integration** with `stratum_notifications` table
- **Template page** displays latest notification with 10-second refresh
- **Connection status** indicator with real-time feedback

### Authentication Solution
Pools requires Bitcoin address authentication:
```typescript
const authorizeMsg = {
  method: "mining.authorize", 
  params: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "x"]  // Bitcoin address + "x"
};
```

## Technical Architecture

### Key Components
```
lib/
├── stratum-collector.ts          # TCP client with auto-reconnect
├── db.ts                         # Extended with stratum table
└── pool-stats-collector.ts       # Auto-starts stratum collector

app/
├── template/page.tsx             # Displays latest notification
├── api/stratum/route.ts          # Database integration
└── components/block-template/    # Notification analysis components
```

### Database Schema
```sql
CREATE TABLE stratum_notifications (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  pool TEXT NOT NULL,
  job_id TEXT NOT NULL,
  prev_block_hash TEXT NOT NULL,
  coinbase1 TEXT NOT NULL,
  coinbase2 TEXT NOT NULL,
  merkle_branches TEXT NOT NULL,
  version TEXT NOT NULL,
  n_bits TEXT NOT NULL,
  n_time TEXT NOT NULL,
  clean_jobs BOOLEAN NOT NULL,
  raw_message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## How It Works

1. **Startup**: Stratum collector starts automatically with pool stats
2. **Connection**: Connects to pool and subscribes to notifications  
3. **Data Flow**: mining.notify messages → Database → API → Template Page
4. **Display**: Latest notification shown with Bitcoin transaction analysis
5. **Updates**: Page refreshes every 10 seconds for live data
