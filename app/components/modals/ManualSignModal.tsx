'use client';

import { useEffect, useState } from 'react';

export interface ManualSignRequest {
  message: string;
  address: string | null;
}

interface ManualSignModalProps {
  request: ManualSignRequest | null;
  onSubmit: (signature: string) => Promise<void>;
  onCancel: () => void;
}

export default function ManualSignModal({ request, onSubmit, onCancel }: ManualSignModalProps) {
  const [signature, setSignature] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields whenever a new signing request opens
  useEffect(() => {
    setSignature('');
    setCopiedField(null);
    setSubmitting(false);
    setError(null);
  }, [request]);

  useEffect(() => {
    if (!request) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [request, submitting, onCancel]);

  if (!request) return null;

  const trimmedSignature = signature.trim();

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubmit = async () => {
    if (!trimmedSignature || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmedSignature);
    } catch (err) {
      console.error('Submit signature error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !submitting) onCancel();
  };

  const copyButton = (value: string, field: string) => (
    <button
      onClick={() => copyToClipboard(value, field)}
      disabled={!value}
      className="px-2 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {copiedField === field ? 'Copied' : 'Copy'}
    </button>
  );

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
          <h2 className="text-xl sm:text-2xl font-bold text-accent-3">Sign Message</h2>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-accent-2">Address</span>
              {copyButton(request.address ?? '', 'address')}
            </div>
            <div className="bg-secondary border border-border px-3 py-2 font-mono text-xs text-foreground break-all">
              {request.address}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-medium text-accent-2" htmlFor="manual-sign-message">
                Message
              </label>
              {copyButton(request.message, 'message')}
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
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-medium text-accent-2" htmlFor="manual-sign-signature">
                Signature
              </label>
              {copyButton(trimmedSignature, 'signature')}
            </div>
            <textarea
              id="manual-sign-signature"
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
              rows={4}
              disabled={submitting}
              placeholder="Paste the BIP322 simple signature produced by your wallet"
              className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-xs resize-y disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!trimmedSignature || submitting}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
