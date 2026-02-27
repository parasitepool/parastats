import { fetch } from '@/lib/http-client';

/**
 * In-memory cache of Bitcoin addresses that have claimed dispensed UTXOs.
 *
 * Polls the dispenser's GET /eligibility endpoint every 60 seconds and
 * stores the set of addresses with any claims. Uses globalThis to survive
 * HMR reloads. Feature is disabled when DISPENSER_API_URL is not set.
 */

const POLL_INTERVAL_MS = 300_000;

const globalForDispenser = globalThis as typeof globalThis & {
  __dispenserClaimedAddresses?: Set<string>;
  __dispenserPollTimer?: ReturnType<typeof setInterval>;
  __dispenserInitialized?: boolean;
};

interface EligibilityUser {
  claims: Record<string, string[]>;
}

type EligibilityResponse = Record<string, EligibilityUser>;

async function pollClaimedAddresses(): Promise<Set<string>> {
  const apiUrl = process.env.DISPENSER_API_URL;
  if (!apiUrl) return new Set();

  try {
    const headers: Record<string, string> = {};
    if (process.env.DISPENSER_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.DISPENSER_API_TOKEN}`;
    }

    const response = await fetch(`${apiUrl}/eligibility`, { headers });
    if (!response.ok) return globalForDispenser.__dispenserClaimedAddresses ?? new Set();

    const data = (await response.json()) as EligibilityResponse;
    const claimed = new Set<string>();

    for (const [address, user] of Object.entries(data)) {
      const hasClaims = Object.values(user.claims).some(arr => arr.length > 0);
      if (hasClaims) {
        claimed.add(address);
      }
    }

    return claimed;
  } catch {
    // Graceful degradation — return previous cache or empty set
    return globalForDispenser.__dispenserClaimedAddresses ?? new Set();
  }
}

function startPolling(): void {
  if (globalForDispenser.__dispenserInitialized) return;
  globalForDispenser.__dispenserInitialized = true;

  // Initial fetch (don't await — callers get empty set until first poll completes)
  pollClaimedAddresses().then(set => {
    globalForDispenser.__dispenserClaimedAddresses = set;
  });

  globalForDispenser.__dispenserPollTimer = setInterval(async () => {
    globalForDispenser.__dispenserClaimedAddresses = await pollClaimedAddresses();
  }, POLL_INTERVAL_MS);

  // Don't keep the process alive just for this timer
  globalForDispenser.__dispenserPollTimer.unref?.();
}

// Static test addresses — remove once dispenser integration is verified
const STATIC_CLAIMED = new Set([
  '3B6fDnqefmguzV6Pumg2GVNyfn2NXrxQfb',
  '3HXFtWSYaAYm7ojfwZUr7TGeNMXFkPYd7n',
  'bc1q27epjwthvwvm0kpgrmr3zelm59cc3xataeedw7',
  'bc1q40w2z0vkfp24gz00mnv3t6r836f8s4qcnus6zr',
  'bc1q6fkrdttuvy9kz0a5ga59lxq00dan82tdf4csaa',
  'bc1qcgdpuu5txzr28n52kmu33avqpefh2sw2dq6j8q',
  'bc1qhdp0v75wt294zrmc577ft36edd46kwft3ykqd9',
  'bc1ql4mcpvdral3dykx4w6hrwdyq0kz4kd48q0jpy6',
  'bc1qp3mqxxnexe97vnnerrganzjh056vudsp7k9pwu',
  'bc1qsqky02hstpuxpeuvm4d085n8g39g2684v2utsc',
  'bc1qv90rxtgalw2yq403nef2jdcks3z8hw7cp58sv6',
  'bc1qwnqxq7p95zwsw3yhts9y8zzhzjsl03jrx2ffqx',
]);

/**
 * Returns the set of full Bitcoin addresses that have claimed at least one
 * dispenser tier. The set is updated in the background every 5 minutes.
 *
 * Returns an empty set when DISPENSER_API_URL is not configured or when
 * the dispenser is unreachable.
 */
export function getClaimedAddresses(): Set<string> {
  if (!process.env.DISPENSER_API_URL) return STATIC_CLAIMED;

  startPolling();
  const polled = globalForDispenser.__dispenserClaimedAddresses ?? new Set<string>();
  return new Set([...STATIC_CLAIMED, ...polled]);
}
