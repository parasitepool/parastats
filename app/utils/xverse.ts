const XVERSE_BROWSER_URL = 'https://connect.xverse.app/browser';

export const XVERSE_PROVIDER_ID = 'XverseProviders.BitcoinProvider';
export const XVERSE_AUTO_CONNECT_PARAM = 'connect';
export const XVERSE_AUTO_CONNECT_VALUE = 'xverse';

/** Best-effort mobile detection for the Xverse in-app browser handoff. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reports itself as Macintosh.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getXverseBrowserUrl(targetUrl: string, autoConnect = false): string {
  const url = new URL(targetUrl);
  if (autoConnect) {
    url.searchParams.set(XVERSE_AUTO_CONNECT_PARAM, XVERSE_AUTO_CONNECT_VALUE);
  }
  return `${XVERSE_BROWSER_URL}?url=${encodeURIComponent(url.toString())}`;
}
