import { proxyDispenserGet } from '@/lib/dispenser-proxy';

export async function GET() {
  return proxyDispenserGet({
    path: '/refinery/price',
    cacheKey: 'dispenser:refinery-price',
    ttlSeconds: 60,
    errorMessage: 'Failed to fetch refinery price',
    passThroughErrorBody: true,
  });
}
