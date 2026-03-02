import { fetch } from '@/lib/http-client';

const POLL_INTERVAL_MS = 60_000;

interface BadgeData {
  blockHeight: number | null;
  contributors: Set<string>;
}

const EMPTY: BadgeData = { blockHeight: null, contributors: new Set() };

const globalForBadge = globalThis as typeof globalThis & {
  __badgeData?: BadgeData;
  __badgePollTimer?: ReturnType<typeof setInterval>;
  __badgeInitialized?: boolean;
};

interface ContributorsResponse {
  block_height: number;
  contributors: string[];
}

async function pollBadgeData(): Promise<BadgeData> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return EMPTY;

  try {
    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/blocks/latest/contributors`, { headers });
    if (!response.ok) return globalForBadge.__badgeData ?? EMPTY;

    const data = (await response.json()) as ContributorsResponse;
    return {
      blockHeight: data.block_height,
      contributors: new Set(data.contributors),
    };
  } catch {
    return globalForBadge.__badgeData ?? EMPTY;
  }
}

function startPolling(): void {
  if (globalForBadge.__badgeInitialized) return;
  globalForBadge.__badgeInitialized = true;

  pollBadgeData().then(data => {
    globalForBadge.__badgeData = data;
  });

  globalForBadge.__badgePollTimer = setInterval(async () => {
    globalForBadge.__badgeData = await pollBadgeData();
  }, POLL_INTERVAL_MS);

  globalForBadge.__badgePollTimer.unref?.();
}

export function getBadgeData(): BadgeData {
  if (!process.env.API_URL) return EMPTY;

  startPolling();
  return globalForBadge.__badgeData ?? EMPTY;
}
