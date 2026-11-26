'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { isProviderInstalled } from '@sats-connect/core';
import { formatAddress } from '@/app/utils/formatters';
import { XVERSE_PROVIDER_ID } from '@/app/utils/xverse';

export type XverseAccountGateMode = 'sign' | 'payment';

export interface XverseAccountGate {
  expectedAddress: string;
  actualAddress: string | null;
  mode: XverseAccountGateMode;
}

interface XverseAccountGateModalProps {
  gate: XverseAccountGate | null;
  onCheck: () => Promise<void>;
  onConnect: () => Promise<void>;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function XverseAccountGateModal({
  gate,
  onCheck,
  onConnect,
  onConfirm,
  onCancel,
}: XverseAccountGateModalProps) {
  const checkingRef = useRef(false);
  const [connectFailed, setConnectFailed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const expectedAddress = gate?.expectedAddress ?? null;

  const runCheck = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      await onCheck();
    } finally {
      checkingRef.current = false;
    }
  }, [onCheck]);

  useEffect(() => {
    if (!expectedAddress) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(async () => {
        await runCheck();
        if (!cancelled) {
          schedule();
        }
      }, 1500);
    };

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [expectedAddress, runCheck]);

  useEffect(() => {
    if (!expectedAddress) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [expectedAddress, onCancel]);

  useEffect(() => {
    setConnectFailed(false);
    setConnecting(false);
    setConfirming(false);
  }, [expectedAddress]);

  if (!gate) return null;

  const hasProvider = isProviderInstalled(XVERSE_PROVIDER_ID);
  const isPayment = gate.mode === 'payment';

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel();
  };

  const handleConnect = async () => {
    setConnectFailed(false);
    setConnecting(true);
    try {
      await onConnect();
    } catch {
      setConnectFailed(true);
    } finally {
      setConnecting(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-4 sm:p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl sm:text-2xl font-bold text-accent-3">
          {isPayment ? 'Confirm Payment Wallet' : 'Switch XVERSE Account'}
        </h2>

        <div className="mt-4 space-y-3 text-sm text-foreground/80">
          <p>{isPayment ? 'This order belongs to' : 'This action must be signed by'}</p>
          <p className="font-mono text-xs sm:text-sm text-foreground break-all bg-secondary border border-border p-2">
            {gate.expectedAddress}
          </p>

          {gate.actualAddress ? (
            <>
              <p>{isPayment ? 'XVERSE will pay from' : 'XVERSE is currently set to'}</p>
              <p className="font-mono text-xs sm:text-sm break-all border border-red-500/40 bg-red-500/10 text-red-400 p-2">
                {gate.actualAddress}
              </p>
              <p>
                {isPayment
                  ? `The order will still be credited to ${formatAddress(gate.expectedAddress)} but the payment will come from the other wallet.`
                  : `Switch to ${formatAddress(gate.expectedAddress)} in XVERSE. This dialog will update automatically.`}
              </p>
              {isPayment && (
                <p>
                  To pay from {formatAddress(gate.expectedAddress)} instead, switch the active
                  XVERSE account. This dialog will update automatically.
                </p>
              )}
            </>
          ) : (
            <p>
              XVERSE&apos;s active account could not be read. Open XVERSE, unlock it if needed,
              and make sure an account is selected.
            </p>
          )}

          {!hasProvider && (
            <p className="text-red-400">
              XVERSE extension not detected. Install or enable it, then try again.
            </p>
          )}

          {connectFailed && (
            <p className="text-red-400">Could not connect XVERSE. Try again or open the extension.</p>
          )}
        </div>

        {!(isPayment && gate.actualAddress) && (
          <div className="mt-4 flex items-center gap-2 text-xs text-foreground/60">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
            <span>
              {gate.actualAddress
                ? 'Waiting for the XVERSE account to match…'
                : 'Waiting for XVERSE to report an account…'}
            </span>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          {gate.actualAddress === null ? (
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={!hasProvider || connecting}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? 'Connecting…' : 'Connect XVERSE'}
            </button>
          ) : !isPayment ? (
            <button
              type="button"
              onClick={() => void runCheck()}
              className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors"
            >
              Check again
            </button>
          ) : null}
          {isPayment && gate.actualAddress && (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={confirming}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? 'Paying…' : `Pay from ${formatAddress(gate.actualAddress)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
