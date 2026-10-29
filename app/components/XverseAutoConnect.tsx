'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isProviderInstalled } from '@sats-connect/core';
import { useWallet } from '@/app/hooks/useWallet';
import {
  isMobileDevice,
  XVERSE_AUTO_CONNECT_PARAM,
  XVERSE_AUTO_CONNECT_VALUE,
  XVERSE_PROVIDER_ID,
} from '@/app/utils/xverse';

/**
 * Completes the Xverse mobile handoff: consumes the ?connect=xverse marker and,
 * when the in-app provider is available, reconnects the wallet automatically.
 */
export default function XverseAutoConnect() {
  const router = useRouter();
  const {
    connectWithLightning,
    isConnected,
    isInitialized,
    isLightningAuthenticated,
  } = useWallet();
  const started = useRef(false);

  useEffect(() => {
    if (!isInitialized || started.current) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get(XVERSE_AUTO_CONNECT_PARAM) !== XVERSE_AUTO_CONNECT_VALUE) {
      return;
    }

    started.current = true;

    // Consume the marker before prompting so refreshes and back navigation
    // don't trigger another wallet popup.
    url.searchParams.delete(XVERSE_AUTO_CONNECT_PARAM);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });

    if (
      !isMobileDevice() ||
      !isProviderInstalled(XVERSE_PROVIDER_ID) ||
      (isConnected && isLightningAuthenticated)
    ) {
      return;
    }

    connectWithLightning()
      .then((result) => {
        if (result) router.push(`/user/${result.address}`);
      })
      .catch((error) => {
        // The normal Connect button remains available if this fails.
        console.error('Xverse auto-connect failed:', error);
      });
  }, [connectWithLightning, isConnected, isInitialized, isLightningAuthenticated, router]);

  return null;
}
