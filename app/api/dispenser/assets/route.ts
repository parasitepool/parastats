import { proxyDispenserGet } from '@/lib/dispenser-proxy';

export async function GET() {
  return proxyDispenserGet({
    path: '/assets',
    cacheKey: 'dispenser:assets',
    ttlSeconds: 60,
    errorMessage: 'Failed to fetch assets',
  });
}
