'use client';

import { useEffect, useState } from 'react';
import {
  clamp,
  durationSecondsFromHashDaysAndRate,
  formatHashrate,
  HASHRATE_SLIDER_DEFAULT,
  HASHRATE_SLIDER_STEPS,
  hashrateForSliderPosition,
  hashrateSliderPositionFor,
  roundHashrateToWholeUnit,
} from '@/app/utils/hashmath';
import { formatLongDuration } from '@/app/utils/formatters';

interface HashrateFieldProps {
  /** Order size in hash-days; the 24-hour default target is numerically equal to it. */
  hashDays: number;
  minHashrate: number;
  defaultHashrate: number;
  maxHashrate: number;
  /** Effective target (custom rate or the default). */
  targetHashrate: number;
  disabled?: boolean;
  /**
   * Called with the new target hashrate, or null to revert to the 24-hour
   * default. Values outside [minHashrate, maxHashrate] are clamped by the
   * parent's state reduction.
   */
  onChange: (hashrateHps: number | null) => void;
}

/**
 * Advanced-order hashrate control: inline target editor plus a logarithmic
 * slider from the order's minimum rate to the router's maximum (24x the
 * default). Editing state is local; any change to the order's work amount
 * (hashDays) closes an open editor and clears the custom rate.
 */
export default function HashrateField({
  hashDays,
  minHashrate,
  defaultHashrate,
  maxHashrate,
  targetHashrate,
  disabled = false,
  onChange,
}: HashrateFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Changing the work amount changes the default target and the min/max
  // bounds, so the in-flight edit (and the custom rate) is reset by the parent;
  // close the editor to match.
  useEffect(() => {
    setEditing(false);
  }, [hashDays]);

  const isDefault = Math.abs(targetHashrate - defaultHashrate) <= defaultHashrate * 1e-9;
  const editUnit = targetHashrate >= 1e15 ? 'PH/s' : 'TH/s';
  const editFactor = editUnit === 'PH/s' ? 1e15 : 1e12;
  const delivery = formatLongDuration(durationSecondsFromHashDaysAndRate(hashDays, targetHashrate));
  const sliderPosition = clamp(
    Math.round(hashrateSliderPositionFor(targetHashrate, minHashrate, defaultHashrate, maxHashrate)),
    0,
    HASHRATE_SLIDER_STEPS,
  );

  const startEdit = () => {
    setEditValue(String(targetHashrate / editFactor));
    setEditing(true);
  };

  const commitEdit = (raw: string) => {
    const parsed = parseFloat(raw.replace(/,/g, '').trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      const target = clamp(
        roundHashrateToWholeUnit(parsed * editFactor),
        minHashrate,
        maxHashrate,
      );
      onChange(Math.abs(target - defaultHashrate) <= defaultHashrate * 1e-9 ? null : target);
    }
    setEditing(false);
  };

  const setFromPosition = (position: number) => {
    if (position === HASHRATE_SLIDER_DEFAULT) {
      onChange(null);
      return;
    }
    const raw = hashrateForSliderPosition(position, minHashrate, defaultHashrate);
    const rounded = clamp(roundHashrateToWholeUnit(raw), minHashrate, maxHashrate);
    onChange(Math.abs(rounded - defaultHashrate) <= defaultHashrate * 1e-9 ? null : rounded);
  };

  return (
    <div className="bg-secondary p-3 border border-border space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <div
          className="cursor-text"
          onClick={() => {
            if (!disabled && !editing) startEdit();
          }}
        >
          <p className="text-foreground break-all">
            {editing ? (
              <span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(editValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(editValue);
                  }}
                  autoFocus
                  className="w-28 bg-secondary border border-foreground text-center text-foreground outline-none"
                /> {editUnit}
              </span>
            ) : (
              <span className="border-b border-dashed border-foreground/40 hover:border-foreground">
                {formatHashrate(targetHashrate)}
              </span>
            )}
          </p>
        </div>
        {isDefault ? (
          <span className="text-xs text-foreground/40">Default · 24h</span>
        ) : (
          <span className="text-xs text-foreground/60">
            Delivery ~{delivery ? `${delivery.value} ${delivery.unit}` : '—'}
          </span>
        )}
      </div>
      <div className="relative h-7">
        <input
          type="range"
          min={0}
          max={HASHRATE_SLIDER_STEPS}
          step={1}
          value={sliderPosition}
          onChange={(e) => setFromPosition(Number(e.target.value))}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full phd-slider z-10"
        />
      </div>
    </div>
  );
}
