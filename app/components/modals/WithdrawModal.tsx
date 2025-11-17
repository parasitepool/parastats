'use client';

import { useEffect, useState, useCallback } from 'react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  balance: number;
  btcAddress: string;
  lightningToken: string;
}

interface WithdrawQuote {
  quantity: number;
  fee: number;
}

type ModalState = 'loading' | 'quote' | 'processing' | 'success' | 'error';

export default function WithdrawModal({
  isOpen,
  onClose,
  onComplete,
  balance,
  btcAddress,
  lightningToken
}: WithdrawModalProps) {
  const [modalState, setModalState] = useState<ModalState>('loading');
  const [quote, setQuote] = useState<WithdrawQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    setModalState('loading');
    setError(null);

    try {
      const response = await fetch('/api/lightning/withdraw/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lightning-Token': lightningToken
        },
        body: JSON.stringify({ l1_address: btcAddress })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to get withdraw quote');
      }

      const data: WithdrawQuote = await response.json();
      setQuote(data);
      setModalState('quote');
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError(err instanceof Error ? err.message : 'Failed to get withdraw quote');
      setModalState('error');
    }
  }, [btcAddress, lightningToken]);

  // Fetch quote when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchQuote();
    } else {
      // Reset state when modal closes
      setModalState('loading');
      setQuote(null);
      setError(null);
    }
  }, [isOpen, fetchQuote]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState !== 'processing') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, modalState]);

  const handleConfirm = async () => {
    if (!quote) return;

    setModalState('processing');
    setError(null);

    try {
      const response = await fetch('/api/lightning/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lightning-Token': lightningToken
        },
        body: JSON.stringify({ l1_address: btcAddress })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to execute withdraw');
      }

      setModalState('success');
      // Wait a moment to show success message, then close and refresh
      setTimeout(() => {
        onClose();
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('Error executing withdraw:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute withdraw');
      setModalState('error');
    }
  };

  const handleCancel = () => {
    if (modalState !== 'processing') {
      onClose();
      onComplete();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && modalState !== 'processing') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const amountAfterFee = quote ? quote.quantity - quote.fee : 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-3">Withdraw</h2>
          <button
            onClick={onClose}
            disabled={modalState === 'processing'}
            className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {modalState === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-accent-3 border-t-transparent rounded-full"></div>
          </div>
        )}

        {modalState === 'quote' && quote && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Current Balance</h3>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-foreground font-semibold">
                  {balance.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Withdraw Fee</h3>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-foreground font-semibold">
                  {quote.fee.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Amount After Fee</h3>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-foreground font-semibold">
                  {amountAfterFee.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Withdraw To Address</h3>
              <div className="bg-secondary p-3 border border-border">
                <p className="text-foreground break-all text-sm">{btcAddress}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-center mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {modalState === 'processing' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-accent-3 border-t-transparent rounded-full"></div>
            <p className="text-foreground">Processing withdrawal...</p>
          </div>
        )}

        {modalState === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="text-green-500">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-foreground font-semibold">Withdrawal Successful!</p>
            <p className="text-sm text-foreground/70">Your funds are on the way.</p>
          </div>
        )}

        {modalState === 'error' && error && (
          <div className="space-y-4">
            <div className="text-sm text-red-500 bg-red-500/10 p-4 border border-red-500/20">
              {error}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
              >
                Close
              </button>
              <button
                onClick={fetchQuote}
                className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

