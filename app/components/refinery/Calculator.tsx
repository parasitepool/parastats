'use client';

import { useState, useEffect, useRef } from 'react';
import {
  HASHRATE_UNITS,
  DURATION_UNITS,
  COST_UNITS,
  DIFF_UNITS,
  HASHDAYS_UNITS,
  parseInput,
  trimValue,
  ResultField,
  UnitField,
} from './calculator-shared';

// Work is counted in difficulty-1 units (1 unit = 2^32 hashes), matching the
// router's HashWork. HashDays = HashWork × 2^32 / 86400.
const HASHES_PER_DIFF_1 = 2 ** 32;
const SECONDS_PER_DAY = 86400;

/** sats → BTC string, trimmed (e.g. 47391 → "0.00047"). */
function formatBtc(sats: number): string {
  return trimValue(sats / 1e8);
}

function formatChance(p: number): { value: string; unit: string } | null {
  if (p <= 0) return null;
  const percent = p * 100;
  if (percent >= 99.995) return { value: '~100', unit: '%' };
  if (percent >= 0.01) return { value: percent.toFixed(2), unit: '%' };
  return { value: `1 in ${Math.round(1 / p).toLocaleString()}`, unit: '' };
}

function formatLongDuration(seconds: number): { value: string; unit: string } | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const years = seconds / (365.25 * 86400);
  if (years >= 2) {
    return { value: years < 100 ? years.toFixed(1) : Math.round(years).toLocaleString(), unit: 'years' };
  }
  const days = seconds / 86400;
  if (days >= 2) return { value: Math.round(days).toLocaleString(), unit: 'days' };
  const hours = seconds / 3600;
  if (hours >= 2) return { value: String(Math.round(hours)), unit: 'hours' };
  return { value: String(Math.max(1, Math.round(seconds / 60))), unit: 'minutes' };
}

interface CalculatorProps {
  /** Current refinery hashprice in sats per PHd; null while loading. */
  hashPrice: number | null;
}

/**
 * Canonical numeric values (full precision, the only thing math ever reads).
 * Display strings in the fields are derived from these and may be rounded;
 * canon is never derived back from rounded display strings.
 */
interface Canon {
  hashrateHps: number;
  durationSecs: number;
  workDiff1: number;
  costSats: number;
  diffTarget: number;
}

// Default canon: 1 PH/s over 24 h (= 1 PHd ≈ 20.117G diff-1).
const DEFAULT_CANON: Canon = {
  hashrateHps: 1e15,
  durationSecs: SECONDS_PER_DAY,
  workDiff1: (1e15 * SECONDS_PER_DAY) / HASHES_PER_DIFF_1,
  costSats: 0,
  diffTarget: 0,
};

export default function Calculator({ hashPrice }: CalculatorProps) {
  const [canon, setCanon] = useState<Canon>(DEFAULT_CANON);
  const [hashrate, setHashrate] = useState('1');
  const [hashrateUnit, setHashrateUnit] = useState('PH/s');
  const [duration, setDuration] = useState('24');
  const [durationUnit, setDurationUnit] = useState('hours');
  const [cost, setCost] = useState('');
  const [costUnit, setCostUnit] = useState('sats');
  const [diff, setDiff] = useState('');
  const [diffUnit, setDiffUnit] = useState('T');
  const [networkDifficulty, setNetworkDifficulty] = useState<number | null>(null);
  const [hashwork, setHashwork] = useState(() => trimValue(DEFAULT_CANON.workDiff1 / 1e9));
  const [hashworkUnit, setHashworkUnit] = useState('G');
  const [hashdays, setHashdays] = useState('1');
  const [hashdaysUnit, setHashdaysUnit] = useState('PHd');

  // Default the cost to the current hashprice once on load (and on reset via
  // remount), unless the user has already typed something. Never auto-updates
  // afterwards, so the triangle stays consistent.
  const costEdited = useRef(false);
  const costInitialized = useRef(false);
  useEffect(() => {
    if (costInitialized.current || costEdited.current || hashPrice == null) return;
    costInitialized.current = true;
    setCostUnit('sats');
    setCost(String(Math.round(hashPrice)));
    setCanon(c => ({ ...c, costSats: hashPrice }));
  }, [hashPrice]);

  // Default the diff target to the network difficulty once it loads, unless
  // the user has already typed something.
  const diffEditedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/network')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled) return;
        if (typeof data?.difficulty === 'number') {
          setNetworkDifficulty(data.difficulty);
          setCanon(c => (diffEditedRef.current ? c : { ...c, diffTarget: data.difficulty }));
          if (!diffEditedRef.current) {
            setDiffUnit('T');
            setDiff(parseFloat((data.difficulty / 1e12).toFixed(2)).toString());
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Display unit factors (units are display-only; canon is unit-free).
  const hsPerUnit = HASHRATE_UNITS.find(u => u.label === hashrateUnit)?.hs ?? 1e15;
  const secondsPerUnit = DURATION_UNITS.find(u => u.label === durationUnit)?.seconds ?? 3600;
  const satsPerUnit = COST_UNITS.find(u => u.label === costUnit)?.sats ?? 1;
  const diffFactor = DIFF_UNITS.find(u => u.label === diffUnit)?.factor ?? 1e12;
  const workFactor = DIFF_UNITS.find(u => u.label === hashworkUnit)?.factor ?? 1e9;
  const daysFactor = HASHDAYS_UNITS.find(u => u.label === hashdaysUnit)?.factor ?? 1e15;

  // Flash fields that were updated programmatically (part of the triangle).
  const [flashFields, setFlashFields] = useState<ReadonlySet<string>>(new Set());
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (fields: string[]) => {
    setFlashFields(new Set(fields));
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlashFields(new Set()), 600);
  };
  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
  }, []);

  // Display writes (rounded for presentation only).
  const writeWorkDisplay = (workDiff1: number) => {
    setHashwork(trimValue(workDiff1 / workFactor));
    setHashdays(trimValue((workDiff1 * HASHES_PER_DIFF_1) / SECONDS_PER_DAY / daysFactor));
  };
  const writeHashrateDisplay = (hashrateHps: number) => {
    setHashrate(trimValue(hashrateHps / hsPerUnit));
  };
  const writeCostDisplay = (costSats: number) => {
    setCost(costUnit === 'BTC' ? formatBtc(costSats) : String(Math.round(costSats)));
  };

  // Scale the cost with the work so the implied hashprice stays constant.
  const scaledCost = (costSats: number, oldWork: number, newWork: number): number =>
    costSats > 0 && oldWork > 0 && newWork > 0 ? costSats * (newWork / oldWork) : costSats;

  // Editing hashrate or duration recomputes the work (and the cost scales).
  const handleRateEdit = (hps: number, secs: number) => {
    const workDiff1 = (hps * secs) / HASHES_PER_DIFF_1;
    const costSats = scaledCost(canon.costSats, canon.workDiff1, workDiff1);
    setCanon({ ...canon, hashrateHps: hps, durationSecs: secs, workDiff1, costSats });
    writeWorkDisplay(workDiff1);
    const costChanged = costSats !== canon.costSats;
    if (costChanged) writeCostDisplay(costSats);
    flash(['hashwork', 'hashdays', 'chance', 'expected', ...(costChanged ? ['cost'] : [])]);
  };

  // Editing a work field syncs the other work field and back-solves the
  // hashrate for the current duration (and the cost scales). Returns whether
  // the cost changed.
  const handleWorkEdit = (workDiff1: number): boolean => {
    const costSats = scaledCost(canon.costSats, canon.workDiff1, workDiff1);
    const hashrateHps = canon.durationSecs > 0
      ? (workDiff1 * HASHES_PER_DIFF_1) / canon.durationSecs
      : canon.hashrateHps;
    setCanon({ ...canon, workDiff1, hashrateHps, costSats });
    if (canon.durationSecs > 0) writeHashrateDisplay(hashrateHps);
    const costChanged = costSats !== canon.costSats;
    if (costChanged) writeCostDisplay(costSats);
    return costChanged;
  };

  const handleHashworkChange = (v: string) => {
    setHashwork(v);
    const workDiff1 = parseInput(v) * workFactor;
    setHashdays(trimValue((workDiff1 * HASHES_PER_DIFF_1) / SECONDS_PER_DAY / daysFactor));
    const costChanged = handleWorkEdit(workDiff1);
    flash(['hashdays', 'hashrate', 'chance', 'expected', ...(costChanged ? ['cost'] : [])]);
  };

  const handleHashdaysChange = (v: string) => {
    setHashdays(v);
    const workDiff1 = (parseInput(v) * daysFactor * SECONDS_PER_DAY) / HASHES_PER_DIFF_1;
    setHashwork(trimValue(workDiff1 / workFactor));
    const costChanged = handleWorkEdit(workDiff1);
    flash(['hashwork', 'hashrate', 'chance', 'expected', ...(costChanged ? ['cost'] : [])]);
  };

  // Unit switches (except Cost's sats/BTC) do not convert the displayed
  // value: the number is reinterpreted in the new unit and canon follows,
  // so the math stays consistent.
  const handleHashrateUnitChange = (next: string) => {
    const nextFactor = HASHRATE_UNITS.find(u => u.label === next)?.hs ?? 1e15;
    setHashrateUnit(next);
    handleRateEdit(parseInput(hashrate) * nextFactor, canon.durationSecs);
  };

  const handleDurationUnitChange = (next: string) => {
    const nextFactor = DURATION_UNITS.find(u => u.label === next)?.seconds ?? 3600;
    setDurationUnit(next);
    handleRateEdit(canon.hashrateHps, parseInput(duration) * nextFactor);
  };

  const handleCostUnitChange = (next: string) => {
    if (next === costUnit) return;
    const value = parseFloat(cost);
    if (Number.isFinite(value) && value > 0) {
      const inSats = value * satsPerUnit;
      setCost(next === 'BTC' ? formatBtc(inSats) : String(Math.round(inSats)));
    }
    setCostUnit(next);
  };

  const handleDiffUnitChange = (next: string) => {
    const nextFactor = DIFF_UNITS.find(u => u.label === next)?.factor ?? 1e12;
    diffEditedRef.current = true;
    setDiffUnit(next);
    setCanon(c => ({ ...c, diffTarget: parseInput(diff) * nextFactor }));
    flash(['chance', 'expected']);
  };

  const handleHashworkUnitChange = (next: string) => {
    const nextFactor = DIFF_UNITS.find(u => u.label === next)?.factor ?? 1e9;
    setHashworkUnit(next);
    const workDiff1 = parseInput(hashwork) * nextFactor;
    setHashdays(trimValue((workDiff1 * HASHES_PER_DIFF_1) / SECONDS_PER_DAY / daysFactor));
    const costChanged = handleWorkEdit(workDiff1);
    flash(['hashdays', 'hashrate', 'chance', 'expected', ...(costChanged ? ['cost'] : [])]);
  };

  const handleHashdaysUnitChange = (next: string) => {
    const nextFactor = HASHDAYS_UNITS.find(u => u.label === next)?.factor ?? 1e15;
    setHashdaysUnit(next);
    const workDiff1 = (parseInput(hashdays) * nextFactor * SECONDS_PER_DAY) / HASHES_PER_DIFF_1;
    setHashwork(trimValue(workDiff1 / workFactor));
    const costChanged = handleWorkEdit(workDiff1);
    flash(['hashwork', 'hashrate', 'chance', 'expected', ...(costChanged ? ['cost'] : [])]);
  };

  // ---- Math (canon only, full precision) ----

  // 1 PHd = 1 PH/s (1e15 H/s) over 1 day.
  const workPhd = (canon.workDiff1 * HASHES_PER_DIFF_1) / SECONDS_PER_DAY / 1e15;
  const price = canon.workDiff1 > 0 && canon.costSats > 0 ? canon.costSats / workPhd : 0;

  // Share arrivals are Poisson: each hash hits the target difficulty with
  // probability 1 / (diff × 2^32). At the network difficulty default this is
  // the chance of a block.
  let chance = 0;
  let expectedSeconds = 0;
  if (canon.diffTarget > 0 && canon.hashrateHps > 0) {
    const expectedHits = (canon.hashrateHps * canon.durationSecs) / (canon.diffTarget * HASHES_PER_DIFF_1);
    chance = 1 - Math.exp(-expectedHits);
    expectedSeconds = (canon.diffTarget * HASHES_PER_DIFF_1) / canon.hashrateHps;
  }

  // Value-based (not flag-based): stays correct across unit switches, manual
  // re-entry of the same value, and resets. Tolerance covers the rounded
  // default fill.
  const isNetworkDiff =
    networkDifficulty != null &&
    canon.diffTarget > 0 &&
    Math.abs(canon.diffTarget - networkDifficulty) / networkDifficulty < 0.001;
  const expected = formatLongDuration(expectedSeconds);
  const chanceFormatted = formatChance(chance);

  return (
    <div className="text-sm grid grid-cols-1 lg:grid-cols-3 gap-x-8 gap-y-4">
      <div className="space-y-2">
        <UnitField
          label="Hashrate"
          value={hashrate}
          onChange={(v) => {
            setHashrate(v);
            handleRateEdit(parseInput(v) * hsPerUnit, canon.durationSecs);
          }}
          units={HASHRATE_UNITS.map(u => u.label)}
          unit={hashrateUnit}
          onUnitChange={handleHashrateUnitChange}
          flash={flashFields.has('hashrate')}
        />
        <UnitField
          label="Duration"
          value={duration}
          onChange={(v) => {
            setDuration(v);
            handleRateEdit(canon.hashrateHps, parseInput(v) * secondsPerUnit);
          }}
          units={DURATION_UNITS.map(u => u.label)}
          unit={durationUnit}
          onUnitChange={handleDurationUnitChange}
        />
        <UnitField
          label="Cost"
          value={cost}
          onChange={(v) => {
            costEdited.current = true;
            setCost(v);
            setCanon(c => ({ ...c, costSats: parseInput(v) * satsPerUnit }));
            flash(['hashprice']);
          }}
          units={COST_UNITS.map(u => u.label)}
          unit={costUnit}
          onUnitChange={handleCostUnitChange}
          flash={flashFields.has('cost')}
        />
      </div>

      <div className="space-y-2 max-lg:border-t max-lg:border-border max-lg:pt-4 lg:border-l lg:border-border lg:pl-8">
        <UnitField
          label={
            <>
              Difficulty
              {isNetworkDiff && <span className="text-foreground/40">{' '}(Network)</span>}
            </>
          }
          value={diff}
          onChange={(v) => {
            diffEditedRef.current = true;
            setDiff(v);
            setCanon(c => ({ ...c, diffTarget: parseInput(v) * diffFactor }));
            flash(['chance', 'expected']);
          }}
          units={DIFF_UNITS.map(u => u.label)}
          unit={diffUnit}
          onUnitChange={handleDiffUnitChange}
        />
        <UnitField
          label="Hashwork"
          value={hashwork}
          onChange={handleHashworkChange}
          units={DIFF_UNITS.map(u => u.label)}
          unit={hashworkUnit}
          onUnitChange={handleHashworkUnitChange}
          flash={flashFields.has('hashwork')}
        />
        <UnitField
          label="Hashdays"
          value={hashdays}
          onChange={handleHashdaysChange}
          units={HASHDAYS_UNITS.map(u => u.label)}
          unit={hashdaysUnit}
          onUnitChange={handleHashdaysUnitChange}
          flash={flashFields.has('hashdays')}
        />
      </div>

      <div className="space-y-2 max-lg:border-t max-lg:border-border max-lg:pt-4 lg:border-l lg:border-border lg:pl-8">
        <ResultField
          label="Hashprice"
          value={price > 0 ? Math.round(price).toLocaleString() : '—'}
          unit="sats/PHd"
          flash={flashFields.has('hashprice')}
        />
        <ResultField
          label="Chance"
          value={chanceFormatted?.value ?? '—'}
          unit={chanceFormatted?.unit ?? ''}
          flash={flashFields.has('chance')}
        />
        <ResultField
          label="Expected time"
          value={expected?.value ?? '—'}
          unit={expected?.unit ?? ''}
          flash={flashFields.has('expected')}
        />
      </div>
    </div>
  );
}
