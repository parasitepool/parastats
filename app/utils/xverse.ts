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

/**
 * Best-effort detection of "wallet extension not installed" errors thrown by
 * sats-connect, so every connect path treats them the same way (e.g. offering
 * the setup guide instead of a generic failure). Patterns are kept specific to
 * wallets/providers: a bare "not found" would also match unrelated errors,
 * which `connectWithLightning` rethrows to all of its callers.
 */
export function isWalletProviderError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)) || '';
  const errorString = message.toLowerCase();
  const errorObj = err && typeof err === 'object'
    ? err as { code?: string; name?: string }
    : null;

  return (
    errorString.includes('no wallet provider') ||
    errorString.includes('wallet provider was found') ||
    errorString.includes('extension') ||
    errorString.includes('not installed') ||
    errorString.includes('no provider') ||
    errorString.includes('provider not found') ||
    errorString.includes('window.btc') ||
    errorString.includes('sats-connect') ||
    errorObj?.code === 'EXTENSION_NOT_FOUND' ||
    errorObj?.name === 'ExtensionNotFoundError' ||
    errorObj?.name === 'ProviderNotFoundError'
  );
}

export function getXverseBrowserUrl(targetUrl: string, autoConnect = false): string {
  const url = new URL(targetUrl);
  if (autoConnect) {
    url.searchParams.set(XVERSE_AUTO_CONNECT_PARAM, XVERSE_AUTO_CONNECT_VALUE);
  }
  return `${XVERSE_BROWSER_URL}?url=${encodeURIComponent(url.toString())}`;
}
