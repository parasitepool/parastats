'use client';

import RetroProgressBar from './RetroProgressBar';
import { formatPercent } from '../utils/hashmath';

interface ParasiteEffortBarProps {
  workSinceLastBlock: number | null;
  currentDifficulty?: number;
}

export default function ParasiteEffortBar({
  workSinceLastBlock,
  currentDifficulty,
}: ParasiteEffortBarProps) {
  const effortPercent =
    workSinceLastBlock && currentDifficulty
      ? (workSinceLastBlock / currentDifficulty) * 100
      : null;
  const dynamicMax = effortPercent === null
    ? 100
    : Math.max(100, Math.ceil(effortPercent / 100) * 100);
  const effortValue = effortPercent === null ? '—' : formatPercent(effortPercent);

  return (
    <RetroProgressBar
      current={effortPercent ?? 0}
      max={dynamicMax}
      label="Parasite Effort"
      formatValue={() => effortValue}
      height={40}
    />
  );
}
