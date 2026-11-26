'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { isProviderInstalled } from '@sats-connect/core';
import { normalizeBitcoinAddress } from '@/app/utils/validators';
import { XVERSE_PROVIDER_ID } from '@/app/utils/xverse';
import {
  queryXverseActiveAccount,
  requestXversePaymentAccount,
  SignCancelledError,
} from '@/app/utils/xverse-rpc';
import type { XverseAccountGate } from '@/app/components/modals/XverseAccountGateModal';

interface AccountGateRequest extends XverseAccountGate {
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

interface UseXverseAccountGateOptions {
  getActiveAddress: () => string | null;
  xverseActiveAddressRef: RefObject<string | null>;
}

export function useXverseAccountGate({
  getActiveAddress,
  xverseActiveAddressRef,
}: UseXverseAccountGateOptions) {
  const [accountGate, setAccountGate] = useState<XverseAccountGate | null>(null);
  const accountGateRef = useRef<AccountGateRequest | null>(null);

  const cancelAccountGate = useCallback(() => {
    const pending = accountGateRef.current;
    accountGateRef.current = null;
    setAccountGate(null);
    pending?.reject(new SignCancelledError());
  }, []);

  const openAccountGate = useCallback(
    (expectedAddress: string, actualAddress: string | null, mode: XverseAccountGate['mode']) =>
      new Promise<void>((resolve, reject) => {
        accountGateRef.current?.reject(new SignCancelledError());
        accountGateRef.current = { expectedAddress, actualAddress, mode, resolve, reject };
        setAccountGate({ expectedAddress, actualAddress, mode });
      }),
    [],
  );

  const checkAccountGate = useCallback(async () => {
    const pending = accountGateRef.current;
    if (!pending) return;

    if (getActiveAddress() !== pending.expectedAddress) {
      accountGateRef.current = null;
      setAccountGate(null);
      pending.reject(new SignCancelledError());
      return;
    }

    const active = await queryXverseActiveAccount();
    if (accountGateRef.current !== pending) return;

    if (!active) {
      pending.actualAddress = null;
      setAccountGate((current) =>
        current && current.actualAddress === null
          ? current
          : current
            ? { ...current, actualAddress: null }
            : current,
      );
      return;
    }

    xverseActiveAddressRef.current = active.address;

    if (active.address === pending.expectedAddress) {
      accountGateRef.current = null;
      setAccountGate(null);
      pending.resolve();
      return;
    }

    pending.actualAddress = active.address;
    setAccountGate((current) =>
      current && current.actualAddress === active.address
        ? current
        : current
          ? { ...current, actualAddress: active.address }
          : current,
    );
  }, [getActiveAddress, xverseActiveAddressRef]);

  const connectAccountGate = useCallback(async () => {
    const pending = accountGateRef.current;
    if (!pending) return;

    const account = await requestXversePaymentAccount(false);
    if (accountGateRef.current !== pending || !account) return;

    xverseActiveAddressRef.current = account.address;

    if (account.address === pending.expectedAddress) {
      accountGateRef.current = null;
      setAccountGate(null);
      pending.resolve();
      return;
    }

    pending.actualAddress = account.address;
    setAccountGate((current) =>
      current ? { ...current, actualAddress: account.address } : current,
    );
  }, [xverseActiveAddressRef]);

  const confirmAccountGate = useCallback(async () => {
    const pending = accountGateRef.current;
    if (!pending || pending.mode !== 'payment') return;

    if (getActiveAddress() !== pending.expectedAddress) {
      accountGateRef.current = null;
      setAccountGate(null);
      pending.reject(new SignCancelledError());
      return;
    }

    const active = await queryXverseActiveAccount();
    if (accountGateRef.current !== pending) return;

    if (!active) {
      pending.actualAddress = null;
      setAccountGate((current) =>
        current ? { ...current, actualAddress: null } : current,
      );
      return;
    }

    xverseActiveAddressRef.current = active.address;

    if (active.address === pending.expectedAddress) {
      accountGateRef.current = null;
      setAccountGate(null);
      pending.resolve();
      return;
    }

    if (active.address !== pending.actualAddress) {
      pending.actualAddress = active.address;
      setAccountGate((current) =>
        current ? { ...current, actualAddress: active.address } : current,
      );
      return;
    }

    accountGateRef.current = null;
    setAccountGate(null);
    pending.resolve();
  }, [getActiveAddress, xverseActiveAddressRef]);

  const gateXverseAccount = useCallback(
    async (expectedAddress: string, mode: XverseAccountGate['mode']) => {
      const normalizedExpected = normalizeBitcoinAddress(expectedAddress);

      if (!isProviderInstalled(XVERSE_PROVIDER_ID)) {
        throw new Error('XVERSE is not available in this browser');
      }

      const active = await queryXverseActiveAccount();
      if (active) {
        xverseActiveAddressRef.current = active.address;
        if (active.address === normalizedExpected) return;
        await openAccountGate(normalizedExpected, active.address, mode);
        return;
      }

      await openAccountGate(normalizedExpected, null, mode);
    },
    [openAccountGate, xverseActiveAddressRef],
  );

  const ensureXverseAccountMatches = useCallback(
    (expectedAddress: string) => gateXverseAccount(expectedAddress, 'sign'),
    [gateXverseAccount],
  );

  const confirmXversePaymentAccount = useCallback(
    (expectedAddress: string) => gateXverseAccount(expectedAddress, 'payment'),
    [gateXverseAccount],
  );

  return {
    accountGate,
    isAccountGateOpen: accountGate !== null,
    cancelAccountGate,
    checkAccountGate,
    connectAccountGate,
    confirmAccountGate,
    ensureXverseAccountMatches,
    confirmXversePaymentAccount,
  };
}
