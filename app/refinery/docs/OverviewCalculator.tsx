'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HASHRATE_UNITS,
  DURATION_UNITS,
  DIFF_UNITS,
  HASHDAYS_UNITS,
  parseInput,
  trimValue,
  UnitField,
} from '@/app/components/refinery/calculator-shared';
import { hashDaysToHashWork, hashWorkToHashDays } from '@/app/utils/hashmath';

interface OverviewCalculatorProps {
  hashrateHps: number;
  durationSecs: number;
  workDiff1: number;
  onHashrateChange: (hashrateHps: number) => void;
  onDurationChange: (durationSecs: number) => void;
  onWorkChange: (workDiff1: number) => void;
  onReset: () => void;
}

function positiveInput(value: string): number | null {
  const parsed = parseInput(value);
  return parsed > 0 ? parsed : null;
}

export default function OverviewCalculator({
  hashrateHps,
  durationSecs,
  workDiff1,
  onHashrateChange,
  onDurationChange,
  onWorkChange,
  onReset,
}: OverviewCalculatorProps) {
  const [hashrate, setHashrate] = useState(() => trimValue(hashrateHps / 1e15));
  const [hashrateUnit, setHashrateUnit] = useState('PH/s');
  const [duration, setDuration] = useState(() => trimValue(durationSecs / 3600));
  const [durationUnit, setDurationUnit] = useState('hours');
  const [hashwork, setHashwork] = useState(() => trimValue(workDiff1 / 1e9));
  const [hashworkUnit, setHashworkUnit] = useState('G');
  const [hashdays, setHashdays] = useState(() => trimValue(hashWorkToHashDays(workDiff1) / 1e15));
  const [hashdaysUnit, setHashdaysUnit] = useState('PHd');

  const hsPerUnit = HASHRATE_UNITS.find(unit => unit.label === hashrateUnit)?.hs ?? 1e15;
  const secondsPerUnit = DURATION_UNITS.find(unit => unit.label === durationUnit)?.seconds ?? 3600;
  const workFactor = DIFF_UNITS.find(unit => unit.label === hashworkUnit)?.factor ?? 1e9;
  const daysFactor = HASHDAYS_UNITS.find(unit => unit.label === hashdaysUnit)?.factor ?? 1e15;

  const lastHashrateRef = useRef(hashrateHps);
  const lastDurationRef = useRef(durationSecs);
  const lastWorkRef = useRef(workDiff1);

  useEffect(() => {
    if (Math.abs(hashrateHps - lastHashrateRef.current) <= Math.max(1, hashrateHps) * 1e-9) return;
    lastHashrateRef.current = hashrateHps;
    setHashrate(trimValue(hashrateHps / hsPerUnit));
  }, [hashrateHps, hsPerUnit]);

  useEffect(() => {
    if (Math.abs(durationSecs - lastDurationRef.current) <= 1e-6) return;
    lastDurationRef.current = durationSecs;
    setDuration(trimValue(durationSecs / secondsPerUnit));
  }, [durationSecs, secondsPerUnit]);

  useEffect(() => {
    if (Math.abs(workDiff1 - lastWorkRef.current) <= Math.max(1, workDiff1) * 1e-9) return;
    lastWorkRef.current = workDiff1;
    setHashwork(trimValue(workDiff1 / workFactor));
    setHashdays(trimValue(hashWorkToHashDays(workDiff1) / daysFactor));
  }, [workDiff1, workFactor, daysFactor]);

  const handleHashrateUnitChange = (next: string) => {
    const nextFactor = HASHRATE_UNITS.find(unit => unit.label === next)?.hs ?? 1e15;
    setHashrateUnit(next);
    const parsed = positiveInput(hashrate);
    if (parsed == null) return;
    const nextHashrateHps = parsed * nextFactor;
    lastHashrateRef.current = nextHashrateHps;
    onHashrateChange(nextHashrateHps);
  };

  const handleDurationUnitChange = (next: string) => {
    const nextFactor = DURATION_UNITS.find(unit => unit.label === next)?.seconds ?? 3600;
    setDurationUnit(next);
    const parsed = positiveInput(duration);
    if (parsed == null) return;
    const nextDurationSecs = parsed * nextFactor;
    lastDurationRef.current = nextDurationSecs;
    onDurationChange(nextDurationSecs);
  };

  const handleHashworkChange = (value: string) => {
    setHashwork(value);
    const parsed = positiveInput(value);
    if (parsed == null) return;
    const nextWorkDiff1 = parsed * workFactor;
    setHashdays(trimValue(hashWorkToHashDays(nextWorkDiff1) / daysFactor));
    lastWorkRef.current = nextWorkDiff1;
    onWorkChange(nextWorkDiff1);
  };

  const handleHashworkUnitChange = (next: string) => {
    const nextFactor = DIFF_UNITS.find(unit => unit.label === next)?.factor ?? 1e9;
    setHashworkUnit(next);
    const parsed = positiveInput(hashwork);
    if (parsed == null) return;
    const nextWorkDiff1 = parsed * nextFactor;
    setHashdays(trimValue(hashWorkToHashDays(nextWorkDiff1) / daysFactor));
    lastWorkRef.current = nextWorkDiff1;
    onWorkChange(nextWorkDiff1);
  };

  const handleHashdaysChange = (value: string) => {
    setHashdays(value);
    const parsed = positiveInput(value);
    if (parsed == null) return;
    const nextWorkDiff1 = hashDaysToHashWork(parsed * daysFactor);
    setHashwork(trimValue(nextWorkDiff1 / workFactor));
    lastWorkRef.current = nextWorkDiff1;
    onWorkChange(nextWorkDiff1);
  };

  const handleHashdaysUnitChange = (next: string) => {
    const nextFactor = HASHDAYS_UNITS.find(unit => unit.label === next)?.factor ?? 1e15;
    setHashdaysUnit(next);
    const parsed = positiveInput(hashdays);
    if (parsed == null) return;
    const nextWorkDiff1 = hashDaysToHashWork(parsed * nextFactor);
    setHashwork(trimValue(nextWorkDiff1 / workFactor));
    lastWorkRef.current = nextWorkDiff1;
    onWorkChange(nextWorkDiff1);
  };

  return (
    <div className="space-y-2 text-base sm:space-y-3">
      <UnitField
        label="Hashrate"
        value={hashrate}
        onChange={value => {
          setHashrate(value);
          const parsed = positiveInput(value);
          if (parsed == null) return;
          const nextHashrateHps = parsed * hsPerUnit;
          lastHashrateRef.current = nextHashrateHps;
          onHashrateChange(nextHashrateHps);
        }}
        units={HASHRATE_UNITS.map(unit => unit.label)}
        unit={hashrateUnit}
        onUnitChange={handleHashrateUnitChange}
      />
      <UnitField
        label="Duration"
        value={duration}
        onChange={value => {
          setDuration(value);
          const parsed = positiveInput(value);
          if (parsed == null) return;
          const nextDurationSecs = parsed * secondsPerUnit;
          lastDurationRef.current = nextDurationSecs;
          onDurationChange(nextDurationSecs);
        }}
        units={DURATION_UNITS.map(unit => unit.label)}
        unit={durationUnit}
        onUnitChange={handleDurationUnitChange}
      />
      <UnitField
        label="Hashwork"
        value={hashwork}
        onChange={handleHashworkChange}
        units={DIFF_UNITS.map(unit => unit.label)}
        unit={hashworkUnit}
        onUnitChange={handleHashworkUnitChange}
      />
      <UnitField
        label="Hashdays"
        value={hashdays}
        onChange={handleHashdaysChange}
        units={HASHDAYS_UNITS.map(unit => unit.label)}
        unit={hashdaysUnit}
        onUnitChange={handleHashdaysUnitChange}
      />
      {/* Same width/height as the input boxes, aligned with the input column;
          the spacer keeps it off the unit-select column. */}
      <div className="flex items-baseline justify-end gap-4">
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            title="Reset the calculator and chart to defaults"
            className="w-28 px-1 py-1 text-[11px] leading-5 whitespace-nowrap text-center border text-foreground/60 hover:text-foreground border-border hover:border-foreground cursor-pointer"
          >
            Reset
          </button>
          <span className="w-20" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
