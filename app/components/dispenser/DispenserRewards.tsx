'use client';

import { useEffect, useState } from 'react';

interface DispenserRewardsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AssetInfo {
  name: string;
  description?: string;
  kind: string;
  total_utxos: number;
  assigned: number;
  is_override_asset: boolean;
}

interface TierInfo {
  name: string;
  threshold: number;
  asset: string;
  start_height?: number;
  end_height?: number;
}

interface Reward {
  name: string;
  description?: string;
  // Lowest share-difficulty target for this reward, in Terahashes (e.g. "21.00").
  targetTera: string;
}

// Threshold values from the dispenser are in trillions.
const TERA = 1_000_000_000_000;

// Only assets with pool remaining are still available
function buildRewards(assets: AssetInfo[], tiers: TierInfo[]): Reward[] {
  const rewards: Reward[] = [];
  for (const asset of assets) {
    if (asset.assigned >= asset.total_utxos) continue;
    const assetTiers = tiers.filter((tier) => tier.asset === asset.name);
    if (assetTiers.length === 0) continue;
    const lowestThreshold = Math.min(...assetTiers.map((tier) => tier.threshold));
    rewards.push({
      name: asset.name,
      description: asset.description,
      targetTera: (lowestThreshold / TERA).toFixed(2),
    });
  }
  return rewards.sort((a, b) => parseFloat(a.targetTera) - parseFloat(b.targetTera));
}

export default function DispenserRewards({ isOpen, onClose }: DispenserRewardsProps) {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const load = async () => {
      setError(null);
      setRewards(null);
      try {
        const [assetsRes, tiersRes] = await Promise.all([
          fetch('/api/dispenser/assets'),
          fetch('/api/dispenser/tiers'),
        ]);
        if (!assetsRes.ok || !tiersRes.ok) {
          throw new Error('Failed to load rewards');
        }
        const assets: AssetInfo[] = await assetsRes.json();
        const tiers: TierInfo[] = await tiersRes.json();
        if (!cancelled) {
          setRewards(buildRewards(assets, tiers));
        }
      } catch (err) {
        console.error('Error loading dispenser rewards:', err);
        if (!cancelled) {
          setError('Failed to load rewards');
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-foreground p-6 max-w-lg w-full mx-4 shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-1">Available Rewards</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-foreground/70 mb-4">
          Rewards and the minimum share difficulty required to earn each.
        </p>

        {error ? (
          <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
            {error}
          </div>
        ) : rewards === null ? (
          <p className="text-sm text-accent-2">Loading…</p>
        ) : rewards.length === 0 ? (
          <p className="text-sm text-accent-2">No rewards available yet.</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {rewards.map((reward) => (
              <li key={reward.name} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{reward.description || reward.name}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-accent-1 flex-shrink-0">
                  {reward.targetTera}T
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
