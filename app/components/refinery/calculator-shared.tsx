'use client';

import { useEffect, useRef, useState } from 'react';
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

/** Custom unit dropdown: the native <select> popup renders detached from the
 *  field (and can land outside the viewport) under mobile viewport emulation,
 *  so the option list is anchored in-page instead. */
function UnitSelect({ units, unit, onChange }: { units: readonly string[]; unit: string; onChange: (unit: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`${unitClassName} relative`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-1 bg-background outline-none cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{unit}</span>
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-full z-20 mt-1 w-full border border-border bg-background shadow-lg">
          {units.map(u => (
            <button
              key={u}
              type="button"
              role="option"
              aria-selected={u === unit}
              onClick={() => { onChange(u); setOpen(false); }}
              className={`block w-full px-2 py-1 text-left whitespace-nowrap hover:bg-foreground/10 ${u === unit ? 'text-foreground' : ''}`}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <UnitSelect units={units} unit={unit} onChange={onUnitChange} />
      </span>
    </div>
  );
}
