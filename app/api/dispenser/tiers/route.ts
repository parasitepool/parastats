import { proxyDispenserGet } from '@/lib/dispenser-proxy';

export async function GET() {
  return proxyDispenserGet({
    path: '/tiers',
    cacheKey: 'dispenser:tiers',
    ttlSeconds: 60,
    errorMessage: 'Failed to fetch tiers',
  });
}
