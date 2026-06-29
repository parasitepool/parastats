'use client';

import { useEffect, useState } from 'react';

export interface ManualSignRequest {
  message: string;
  address: string | null;
}

interface ManualSignModalProps {
  request: ManualSignRequest | null;
  onSubmit: (signature: string) => void;
  onCancel: () => void;
}

export default function ManualSignModal({ request, onSubmit, onCancel }: ManualSignModalProps) {
  const [signature, setSignature] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset fields whenever a new signing request opens
  useEffect(() => {
    setSignature('');
    setCopied(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [request, onCancel]);

  if (!request) return null;

  const trimmedSignature = signature.trim();

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(request.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubmit = () => {
    if (!trimmedSignature) return;
    onSubmit(trimmedSignature);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-4 sm:p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-accent-3">Sign Message</h2>
            {request.address && (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-xs uppercase text-foreground/50">Sign with address</span>
                <span className="inline-block max-w-full border border-border bg-secondary px-2 py-1 font-mono text-xs text-foreground break-all">
                  {request.address}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-secondary border border-border p-3 text-sm text-foreground/80 space-y-1">
            <p>Sign the message below with the wallet that owns the address shown, then paste the signature.</p>
            <p className="text-xs text-foreground/60">
              In Sparrow (or another wallet) use its message-signing feature to produce a BIP322 signature.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-medium text-accent-2" htmlFor="manual-sign-message">
                Message
              </label>
              <button
                onClick={handleCopyMessage}
                className="px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              id="manual-sign-message"
              value={request.message}
              readOnly
              rows={3}
              className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none font-mono text-xs resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-sign-signature">
              Signature
            </label>
            <textarea
              id="manual-sign-signature"
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
              rows={4}
              placeholder="Paste the signature produced by your wallet"
              className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-xs resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!trimmedSignature}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
