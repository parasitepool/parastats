import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL_MS = 30_000;

interface Order {
  status: string;
  target: { username: string };
  target_work: number | null;
  stats: { hashrate_1m: number };
  [k: string]: unknown;
}

interface StatusData {
  orders: Order[];
  stats: { hashrate_1m: number };
  [k: string]: unknown;
}

let cached: { data: StatusData; time: number } | null = null;

export async function GET(request: NextRequest) {
  const routerBase = process.env.ROUTER_API_URL;
  if (!routerBase) {
    return NextResponse.json({ error: 'Router not configured' }, { status: 503 });
  }

  if (!cached || Date.now() - cached.time >= CACHE_TTL_MS) {
    try {
      const res = await fetch(`${routerBase}/api/router/status`);
      if (!res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }
      const data: StatusData = await res.json();
      data.orders = data.orders?.map((order) => {
        const { workers, sessions, ...rest } = order;
        void workers; void sessions;
        return rest as Order;
      }) ?? [];
      cached = { data, time: Date.now() };
    } catch {
      return NextResponse.json({ error: 'Router unavailable' }, { status: 502 });
    }
  }

  const { data } = cached;
  const address = request.nextUrl.searchParams.get('address');

  const used = data.orders
    .filter(o => o.status === 'active' && o.target_work !== null)
    .reduce((sum, o) => sum + o.stats.hashrate_1m, 0);

  const orders = address
    ? data.orders.filter(o =>
        o.target.username === address || o.target.username.startsWith(address + '.'),
      )
    : [];

  return NextResponse.json({
    stats: data.stats,
    used,
    orders,
  });
}
