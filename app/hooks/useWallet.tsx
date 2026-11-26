'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSigningProtocols,
  addListener,
  isProviderInstalled,
  request,
} from '@sats-connect/core';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import {
  getXverseBrowserUrl,
  isMobileDevice,
  isWalletProviderError,
  XVERSE_PROVIDER_ID,
} from '@/app/utils/xverse';
import {
  extractPaymentAddress,
  queryXverseActiveAccount,
  requestXversePaymentAccount,
  SignCancelledError,
  signWithXverse,
  XverseAccountMismatchError,
} from '@/app/utils/xverse-rpc';
import {
  EMPTY_WALLET_STORE,
  getActiveWallet,
  loadWalletStore,
  parseWalletStore,
  removeWallet as removeWalletFromStore,
  saveWalletStore,
  selectWallet,
  upsertWallet,
  WALLETS_STORAGE_KEY,
  type SavedWallet,
  type WalletStoreState,
  type WalletType,
} from '@/app/utils/wallet-storage';
import { useXverseAccountGate } from '@/app/hooks/useXverseAccountGate';
import ManualSignModal, { type ManualSignRequest } from '@/app/components/modals/ManualSignModal';
import WalletConnectModal, { type WalletConnectView } from '@/app/components/modals/WalletConnectModal';
import XverseAccountGateModal from '@/app/components/modals/XverseAccountGateModal';
import HelpModal from '@/app/components/modals/HelpModal';

export { SignCancelledError, XverseAccountMismatchError };
export type { SavedWallet, WalletType, WalletConnectView };

export type LightningAuthStatus = 'none' | 'checking' | 'authenticated' | 'expired';

export interface OpenConnectModalOptions {
  initialView?: WalletConnectView;
  stayInPlace?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SignMessageParams {
  message: string;
  protocol?: MessageSigningProtocols;
  address?: string;
}

interface SignMessage {
  (params: SignMessageParams): Promise<string>;
  <T>(params: SignMessageParams & { submit: (signature: string) => Promise<T> }): Promise<T>;
}

interface PendingSign extends ManualSignRequest {
  submit?: (signature: string) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface ModalSession {
  view: WalletConnectView;
  stayInPlace: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface WalletContextType {
  activeWallet: SavedWallet | null;
  wallets: SavedWallet[];
  address: string | null;
  addressPublicKey: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  lightningAuthStatus: LightningAuthStatus;
  isLightningAuthenticated: boolean;
  isAccountGateOpen: boolean;
  isManualSignOpen: boolean;
  isConnectingXverse: boolean;
  isInitialized: boolean;
  connectXverse: (options?: { forcePrompt?: boolean }) => Promise<{
    address: string;
    lightningAuthenticated: boolean;
  } | null>;
  connectManual: (manualAddress: string) => Promise<string | null>;
  switchWallet: (targetAddress: string) => Promise<void>;
  removeWallet: (targetAddress: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshLightningAuth: () => Promise<boolean>;
  markLightningExpired: () => void;
  ensureXverseAccountMatches: (expectedAddress: string) => Promise<void>;
  confirmXversePaymentAccount: (expectedAddress: string) => Promise<void>;
  signMessage: SignMessage;
  openConnectModal: (options?: OpenConnectModalOptions) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

async function fetchLightningStatus(address: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/lightning/auth/status?address=${encodeURIComponent(address)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { authenticated?: unknown };
    return data.authenticated === true;
  } catch {
    return false;
  }
}

async function clearServerLightningSession(address: string): Promise<void> {
  try {
    await fetch('/api/lightning/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
  } catch {
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [store, setStore] = useState<WalletStoreState>(EMPTY_WALLET_STORE);
  const [lightningAuthStatus, setLightningAuthStatus] = useState<LightningAuthStatus>('none');
  const [isConnectingXverse, setIsConnectingXverse] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingSign, setPendingSign] = useState<PendingSign | null>(null);
  const [modalSession, setModalSession] = useState<ModalSession | null>(null);
  const [helpSession, setHelpSession] = useState<Omit<ModalSession, 'view'> | null>(null);

  const storeRef = useRef<WalletStoreState>(EMPTY_WALLET_STORE);
  const xverseActiveAddressRef = useRef<string | null>(null);
  const pathnameRef = useRef<string>(pathname);
  const lightningCheckIdRef = useRef(0);
  const onOpenChangeRef = useRef<((open: boolean) => void) | undefined>(undefined);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const anyConnectModalOpen = modalSession !== null || helpSession !== null;
  useEffect(() => {
    onOpenChangeRef.current?.(anyConnectModalOpen);
    if (!anyConnectModalOpen) {
      onOpenChangeRef.current = undefined;
    }
  }, [anyConnectModalOpen]);

  const getActiveAddress = useCallback(() => storeRef.current.activeAddress, []);

  const {
    accountGate,
    isAccountGateOpen,
    cancelAccountGate,
    checkAccountGate,
    connectAccountGate,
    confirmAccountGate,
    ensureXverseAccountMatches,
    confirmXversePaymentAccount,
  } = useXverseAccountGate({
    getActiveAddress,
    xverseActiveAddressRef,
  });

  const activeWallet = getActiveWallet(store);
  const address = activeWallet?.address ?? null;
  const addressPublicKey = activeWallet?.type === 'xverse' ? activeWallet.publicKey : null;
  const walletType = activeWallet?.type ?? null;
  const isConnected = activeWallet !== null;
  const isLightningAuthenticated = lightningAuthStatus === 'authenticated';

  const cancelPendingSign = useCallback(() => {
    setPendingSign((prev) => {
      prev?.reject(new SignCancelledError());
      return null;
    });
  }, []);

  const commitStore = useCallback((next: WalletStoreState) => {
    storeRef.current = next;
    setStore(next);
    try {
      saveWalletStore(window.localStorage, next);
    } catch (error) {
      console.error('Failed to persist wallet store:', error);
    }
  }, []);

  const refreshLightningStatus = useCallback(async (targetAddress: string) => {
    const checkId = ++lightningCheckIdRef.current;
    setLightningAuthStatus('checking');

    const authenticated = await fetchLightningStatus(targetAddress);
    if (checkId !== lightningCheckIdRef.current) return;
    if (storeRef.current.activeAddress !== targetAddress) return;

    setLightningAuthStatus(authenticated ? 'authenticated' : 'none');
  }, []);

  const navigateIfOnOwnProfile = useCallback(
    (previousAddress: string | null, nextAddress: string) => {
      if (!previousAddress || previousAddress === nextAddress) return;
      const currentPath = pathnameRef.current;
      if (!currentPath?.startsWith('/user/')) return;
      const segment = currentPath.slice('/user/'.length).split('/')[0];
      if (!segment) return;
      try {
        const decoded = normalizeBitcoinAddress(decodeURIComponent(segment));
        if (decoded === previousAddress) {
          router.push(`/user/${nextAddress}`);
        }
      } catch {
      }
    },
    [router],
  );

  const switchWallet = useCallback(
    async (targetAddress: string) => {
      const normalized = normalizeBitcoinAddress(targetAddress);
      const previousAddress = storeRef.current.activeAddress;
      const next = selectWallet(storeRef.current, normalized);
      if (next === storeRef.current) return;

      cancelPendingSign();
      cancelAccountGate();
      commitStore(next);

      const nextActive = getActiveWallet(next);
      if (nextActive?.type === 'xverse') {
        void refreshLightningStatus(nextActive.address);
      } else {
        lightningCheckIdRef.current++;
        setLightningAuthStatus('none');
      }

      navigateIfOnOwnProfile(previousAddress, normalized);
    },
    [cancelAccountGate, cancelPendingSign, commitStore, navigateIfOnOwnProfile, refreshLightningStatus],
  );

  useEffect(() => {
    let loaded = EMPTY_WALLET_STORE;
    try {
      loaded = loadWalletStore(window.localStorage);
    } catch (error) {
      console.error('Failed to load wallet store:', error);
    }
    storeRef.current = loaded;
    setStore(loaded);
    setIsInitialized(true);

    const active = getActiveWallet(loaded);
    if (active?.type === 'xverse') {
      void refreshLightningStatus(active.address);
    }
  }, [refreshLightningStatus]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== WALLETS_STORAGE_KEY) return;
      const next = parseWalletStore(event.newValue);
      const previousActive = storeRef.current.activeAddress;

      storeRef.current = next;
      setStore(next);

      if (next.activeAddress !== previousActive) {
        cancelPendingSign();
        cancelAccountGate();
        const nextActive = getActiveWallet(next);
        if (nextActive?.type === 'xverse') {
          void refreshLightningStatus(nextActive.address);
        } else {
          lightningCheckIdRef.current++;
          setLightningAuthStatus('none');
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [cancelAccountGate, cancelPendingSign, refreshLightningStatus]);

  useEffect(() => {
    if (!isInitialized || !isProviderInstalled(XVERSE_PROVIDER_ID)) return;

    const handleXverseAccountUpdate = async (eventPayload?: unknown) => {
      const eventRecord =
        eventPayload && typeof eventPayload === 'object'
          ? (eventPayload as Record<string, unknown>)
          : null;
      const fromEvent = extractPaymentAddress(eventRecord?.addresses);
      const resolved = fromEvent ?? (await queryXverseActiveAccount());
      if (!resolved) return;

      xverseActiveAddressRef.current = resolved.address;
    };

    let removeAccountListener: (() => void) | undefined;
    let removeDisconnectListener: (() => void) | undefined;

    try {
      removeAccountListener = addListener('accountChange', (event: unknown) => {
        void handleXverseAccountUpdate(event);
      });
      removeDisconnectListener = addListener('disconnect', () => {
        xverseActiveAddressRef.current = null;
      });
    } catch {
    }

    return () => {
      removeAccountListener?.();
      removeDisconnectListener?.();
    };
  }, [isInitialized]);

  const addAddressToMonitoring = useCallback(async (addr: string) => {
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
          console.error('Too many addresses added recently');
        } else {
          console.error('Error adding address to monitoring:', data.error);
        }
      }
    } catch (error) {
      console.error('Error adding address to monitoring:', error);
    }
  }, []);

  const signMessage = useCallback(
    async ({
      message,
      protocol = MessageSigningProtocols.BIP322,
      address: signingAddress,
      submit,
    }: SignMessageParams & {
      submit?: (signature: string) => Promise<unknown>;
    }): Promise<unknown> => {
      const currentActive = getActiveWallet(storeRef.current);
      const signer = signingAddress
        ? normalizeBitcoinAddress(signingAddress)
        : currentActive?.address ?? null;

      if (currentActive?.type === 'manual') {
        if (protocol !== MessageSigningProtocols.BIP322) {
          throw new Error('Manual wallets only support BIP322 signing');
        }
        return new Promise<unknown>((resolve, reject) => {
          setPendingSign((prev) => {
            prev?.reject(new SignCancelledError());
            return { message, address: signer, submit, resolve, reject };
          });
        });
      }

      if (!signer) {
        throw new Error('Wallet not connected');
      }

      if (currentActive?.type === 'xverse') {
        await ensureXverseAccountMatches(signer);
      }

      const signature = await signWithXverse(signer, message, protocol);

      if (submit) {
        return await submit(signature);
      }

      return signature;
    },
    [ensureXverseAccountMatches],
  ) as SignMessage;

  const requestNonce = useCallback(async (userAddress: string): Promise<string> => {
    const response = await fetch('/api/lightning/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: userAddress }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request nonce: ${response.statusText}`);
    }

    const data = (await response.json()) as { nonce: string };
    return data.nonce;
  }, []);

  const loginWithSignature = useCallback(
    async (
      userAddress: string,
      publicKey: string,
      signature: string,
      nonce: string,
    ): Promise<void> => {
      const response = await fetch('/api/lightning/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: userAddress,
          public_key: publicKey,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${errorText}`);
      }
    },
    [],
  );

  const performLightningAuth = useCallback(
    async (userAddress: string, publicKey: string): Promise<boolean> => {
      const nonce = await requestNonce(userAddress);
      const signature = await signWithXverse(
        userAddress,
        nonce,
        MessageSigningProtocols.ECDSA,
      );
      if (storeRef.current.activeAddress !== userAddress) {
        return false;
      }

      await loginWithSignature(userAddress, publicKey, signature, nonce);

      const currentActive = getActiveWallet(storeRef.current);
      if (currentActive?.type === 'xverse' && currentActive.address === userAddress) {
        lightningCheckIdRef.current++;
        setLightningAuthStatus('authenticated');
        return true;
      }

      return false;
    },
    [requestNonce, loginWithSignature],
  );

  const connectXverse = useCallback(async (options?: { forcePrompt?: boolean }): Promise<{
    address: string;
    lightningAuthenticated: boolean;
  } | null> => {
    if (!isProviderInstalled(XVERSE_PROVIDER_ID) && isMobileDevice()) {
      window.location.href = getXverseBrowserUrl(window.location.href, true);
      return null;
    }

    setIsConnectingXverse(true);
    try {
      const paymentAccount = await requestXversePaymentAccount(options?.forcePrompt ?? false);
      if (!paymentAccount) {
        if (options?.forcePrompt) {
          const active = await queryXverseActiveAccount();
          xverseActiveAddressRef.current = active?.address ?? null;
        }
        return null;
      }

      const { address: paymentAddress, publicKey } = paymentAccount;
      xverseActiveAddressRef.current = paymentAddress;

      cancelPendingSign();
      cancelAccountGate();
      lightningCheckIdRef.current++;
      setLightningAuthStatus('checking');

      const next = upsertWallet(storeRef.current, {
        address: paymentAddress,
        type: 'xverse',
        publicKey,
        lastUsedAt: Date.now(),
      });
      commitStore(next);

      await addAddressToMonitoring(paymentAddress);

      if (storeRef.current.activeAddress !== paymentAddress) {
        return { address: paymentAddress, lightningAuthenticated: false };
      }

      const alreadyAuthenticated = await fetchLightningStatus(paymentAddress);
      if (storeRef.current.activeAddress !== paymentAddress) {
        return { address: paymentAddress, lightningAuthenticated: alreadyAuthenticated };
      }

      if (alreadyAuthenticated) {
        setLightningAuthStatus('authenticated');
        return { address: paymentAddress, lightningAuthenticated: true };
      }

      try {
        const authenticated = await performLightningAuth(paymentAddress, publicKey);
        return { address: paymentAddress, lightningAuthenticated: authenticated };
      } catch (authError) {
        if (storeRef.current.activeAddress === paymentAddress) {
          setLightningAuthStatus('none');
        }
        if (!(authError instanceof SignCancelledError)) {
          console.error('Failed to complete Lightning auth:', authError);
        }
        return { address: paymentAddress, lightningAuthenticated: false };
      }
    } catch (error) {
      if (isWalletProviderError(error)) {
        throw error;
      }
      console.error('Failed to connect Xverse wallet:', error);
      return null;
    } finally {
      setIsConnectingXverse(false);
    }
  }, [addAddressToMonitoring, cancelAccountGate, cancelPendingSign, commitStore, performLightningAuth]);

  const connectManual = useCallback(
    async (manualAddress: string): Promise<string | null> => {
      const normalizedAddress = normalizeBitcoinAddress(manualAddress);
      if (!isValidBitcoinAddress(normalizedAddress)) {
        return null;
      }

      cancelPendingSign();
      cancelAccountGate();
      lightningCheckIdRef.current++;
      setLightningAuthStatus('none');

      const next = upsertWallet(storeRef.current, {
        address: normalizedAddress,
        type: 'manual',
        lastUsedAt: Date.now(),
      });
      commitStore(next);

      await addAddressToMonitoring(normalizedAddress);
      return normalizedAddress;
    },
    [addAddressToMonitoring, cancelAccountGate, cancelPendingSign, commitStore],
  );

  const refreshLightningAuth = useCallback(async (): Promise<boolean> => {
    const currentActive = getActiveWallet(storeRef.current);
    if (!currentActive || currentActive.type !== 'xverse') {
      throw new Error('XVERSE wallet not connected');
    }

    await ensureXverseAccountMatches(currentActive.address);

    try {
      return await performLightningAuth(currentActive.address, currentActive.publicKey);
    } catch (error) {
      if (error instanceof SignCancelledError) {
        return false;
      }
      throw error;
    }
  }, [ensureXverseAccountMatches, performLightningAuth]);

  const markLightningExpired = useCallback(() => {
    const currentActive = getActiveWallet(storeRef.current);
    if (currentActive?.type === 'xverse') {
      lightningCheckIdRef.current++;
      setLightningAuthStatus('expired');
    }
  }, []);

  const removeWallet = useCallback(
    async (targetAddress: string) => {
      const normalized = normalizeBitcoinAddress(targetAddress);
      const { next, removed } = removeWalletFromStore(storeRef.current, normalized);
      if (!removed) return;

      const wasActive = storeRef.current.activeAddress === removed.address;
      commitStore(next);

      if (wasActive) {
        cancelPendingSign();
        cancelAccountGate();
        lightningCheckIdRef.current++;
        setLightningAuthStatus('none');
      }

      if (removed.type === 'xverse') {
        await clearServerLightningSession(removed.address);

        const hasRemainingXverse = storeRef.current.wallets.some((wallet) => wallet.type === 'xverse');
        if (!hasRemainingXverse && isProviderInstalled(XVERSE_PROVIDER_ID)) {
          try {
            await request('wallet_disconnect', null);
          } catch {
          }
          xverseActiveAddressRef.current = null;
        }
      }
    },
    [cancelAccountGate, cancelPendingSign, commitStore],
  );

  const disconnect = useCallback(async () => {
    const activeAddress = storeRef.current.activeAddress;
    if (!activeAddress) return;
    await removeWallet(activeAddress);
  }, [removeWallet]);

  const openConnectModal = useCallback((options?: OpenConnectModalOptions) => {
    if (options?.onOpenChange) {
      onOpenChangeRef.current = options.onOpenChange;
    }
    const defaultView: WalletConnectView =
      getActiveWallet(storeRef.current) ? 'switcher' : 'choice';
    setHelpSession(null);
    setModalSession({
      view: options?.initialView ?? defaultView,
      stayInPlace: options?.stayInPlace ?? false,
      onOpenChange: options?.onOpenChange,
    });
  }, []);

  const handleModalXverseConnect = useCallback(async () => {
    const stayInPlace = modalSession?.stayInPlace ?? false;
    const onOpenChange = modalSession?.onOpenChange;

    try {
      const activeXverse = await queryXverseActiveAccount();
      xverseActiveAddressRef.current = activeXverse?.address ?? null;
      const shouldForcePrompt = Boolean(
        activeXverse &&
        storeRef.current.wallets.some(
          (wallet) => wallet.type === 'xverse' && wallet.address === activeXverse.address,
        ),
      );
      const result = await connectXverse({ forcePrompt: shouldForcePrompt });
      if (result && !stayInPlace) {
        router.push(`/user/${result.address}`);
      }
    } catch (error) {
      if (isWalletProviderError(error)) {
        if (onOpenChange) {
          onOpenChangeRef.current = onOpenChange;
        }
        setHelpSession({ stayInPlace, onOpenChange });
      } else {
        console.error('Failed to connect:', error);
      }
    }
  }, [connectXverse, modalSession, router]);

  return (
    <WalletContext.Provider
      value={{
        activeWallet,
        wallets: store.wallets,
        address,
        addressPublicKey,
        walletType,
        isConnected,
        lightningAuthStatus,
        isLightningAuthenticated,
        isAccountGateOpen,
        isManualSignOpen: pendingSign !== null,
        isConnectingXverse,
        isInitialized,
        connectXverse,
        connectManual,
        switchWallet,
        removeWallet,
        disconnect,
        refreshLightningAuth,
        markLightningExpired,
        ensureXverseAccountMatches,
        confirmXversePaymentAccount,
        signMessage,
        openConnectModal,
      }}
    >
      {children}

      <WalletConnectModal
        isOpen={modalSession !== null}
        initialView={modalSession?.view ?? 'choice'}
        stayInPlace={modalSession?.stayInPlace ?? false}
        isConnectingXverse={isConnectingXverse}
        wallets={store.wallets}
        activeWallet={activeWallet}
        onClose={() => setModalSession(null)}
        onXverse={() => {
          void handleModalXverseConnect();
        }}
        onSwitchWallet={switchWallet}
        onRemoveWallet={removeWallet}
        onDisconnectWallet={disconnect}
        onConnectManual={connectManual}
      />

      <HelpModal
        isOpen={helpSession !== null}
        onClose={() => setHelpSession(null)}
        onManualConnect={() => {
          const currentHelp = helpSession;
          setHelpSession(null);
          if (currentHelp?.onOpenChange) {
            onOpenChangeRef.current = currentHelp.onOpenChange;
          }
          setModalSession({
            view: 'manual',
            stayInPlace: currentHelp?.stayInPlace ?? false,
            onOpenChange: currentHelp?.onOpenChange,
          });
        }}
      />

      <XverseAccountGateModal
        gate={accountGate}
        onCheck={checkAccountGate}
        onConnect={connectAccountGate}
        onConfirm={confirmAccountGate}
        onCancel={cancelAccountGate}
      />

      <ManualSignModal
        request={pendingSign}
        onSubmit={async (signature) => {
          if (!pendingSign) return;
          const result = pendingSign.submit ? await pendingSign.submit(signature) : signature;
          pendingSign.resolve(result);
          setPendingSign(null);
        }}
        onCancel={() => {
          pendingSign?.reject(new SignCancelledError());
          setPendingSign(null);
        }}
      />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
