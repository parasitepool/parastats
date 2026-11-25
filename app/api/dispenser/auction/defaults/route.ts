import { proxyDispenserGet } from '@/lib/dispenser-proxy';

export async function GET() {
  return proxyDispenserGet({
    path: '/auction/defaults',
    cacheKey: 'dispenser:auction-defaults',
    ttlSeconds: 60,
    errorMessage: 'Failed to fetch auction defaults',
  });
}
