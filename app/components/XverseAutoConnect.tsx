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

export default function XverseAutoConnect() {
  const router = useRouter();
  const {
    connectXverse,
    isConnected,
    isInitialized,
    isLightningAuthenticated,
    lightningAuthStatus,
    walletType,
  } = useWallet();
  const started = useRef(false);

  useEffect(() => {
    if (!isInitialized || lightningAuthStatus === 'checking' || started.current) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get(XVERSE_AUTO_CONNECT_PARAM) !== XVERSE_AUTO_CONNECT_VALUE) {
      return;
    }

    started.current = true;

    url.searchParams.delete(XVERSE_AUTO_CONNECT_PARAM);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });

    if (
      !isMobileDevice() ||
      !isProviderInstalled(XVERSE_PROVIDER_ID) ||
      (isConnected && walletType === 'xverse' && isLightningAuthenticated)
    ) {
      return;
    }

    connectXverse()
      .then((result) => {
        if (result) router.push(`/user/${result.address}`);
      })
      .catch((error) => {
        console.error('Xverse auto-connect failed:', error);
      });
  }, [connectXverse, isConnected, isInitialized, isLightningAuthenticated, lightningAuthStatus, walletType, router]);

  return null;
}
