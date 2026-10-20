'use client';

import type { ReactNode } from 'react';

// Hashrate units in H/s; work is priced per PHd (1 PH/s over 1 day).
export const HASHRATE_UNITS = [
  { label: 'TH/s', hs: 1e12 },
  { label: 'PH/s', hs: 1e15 },
  { label: 'EH/s', hs: 1e18 },
] as const;

export const DURATION_UNITS = [
  { label: 'hours', seconds: 3600 },
  { label: 'days', seconds: 86400 },
] as const;

export const COST_UNITS = [
  { label: 'sats', sats: 1 },
  { label: 'BTC', sats: 1e8 },
] as const;

// Difficulty units (e.g. a 9T dispenser share).
export const DIFF_UNITS = [
  { label: 'K', factor: 1e3 },
  { label: 'M', factor: 1e6 },
  { label: 'G', factor: 1e9 },
  { label: 'T', factor: 1e12 },
  { label: 'P', factor: 1e15 },
] as const;

// Hash-days units.
export const HASHDAYS_UNITS = [
  { label: 'THd', factor: 1e12 },
  { label: 'PHd', factor: 1e15 },
  { label: 'EHd', factor: 1e18 },
] as const;

/** Trim a computed value for display in an editable field: at most two
 *  decimals (two significant figures for very small values). Display-only;
 *  canonical math keeps full precision. */
export function trimValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value >= 0.01) {
    const rounded = parseFloat(value.toFixed(2));
    if (rounded > 0) return rounded.toString();
  }
  return parseFloat(value.toPrecision(2)).toString();
}

export function parseInput(raw: string): number {
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-foreground/60">{label}</span>
      <span className="flex items-center gap-2 text-foreground text-right">{children}</span>
    </div>
  );
}

/** Read-only row matching the UnitField geometry: the value aligns with the
 *  input boxes, the unit with the unit selectors. */
export function ResultField({ label, value, unit = '', flash = false }: { label: ReactNode; value: string; unit?: string; flash?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-foreground/60">{label}</span>
      <span className="flex items-center gap-2 text-foreground text-right">
        <span className={`w-28 border px-2 py-1 text-left transition-colors duration-500${flash ? ' bg-foreground/10 border-foreground' : ' border-transparent'}`}>{value}</span>
        <span className={unitClassName}>{unit}</span>
      </span>
    </div>
  );
}

const inputClassName =
  'w-28 bg-background border border-border px-2 py-1 text-right text-foreground outline-none focus:border-foreground transition-colors duration-500';

// Fixed-width column so the units line up across rows.
const unitClassName = 'w-20 text-sm text-foreground/60 text-left';

interface UnitFieldProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  units: readonly string[];
  unit: string;
  onUnitChange: (unit: string) => void;
  /** Optional element rendered just left of the input box (e.g. a reset button). */
  action?: ReactNode;
  /** Briefly highlight the field to signal it was updated programmatically. */
  flash?: boolean;
}

export function UnitField({ label, value, onChange, units, unit, onUnitChange, action, flash = false }: UnitFieldProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-foreground/60">{label}</span>
      <span className="flex items-center gap-2 text-foreground text-right">
        {action}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClassName}${flash ? ' bg-foreground/10 border-foreground' : ''}`}
          placeholder="0"
        />
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          className={`${unitClassName} bg-background outline-none cursor-pointer`}
        >
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </span>
    </div>
  );
}
