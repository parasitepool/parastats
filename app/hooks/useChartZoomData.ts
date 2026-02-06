"use client";

import { useState, useRef, useCallback } from "react";
import { getHistoricalPoolStats } from "../utils/api";
import type { HistoricalPoolStats } from "../api/pool-stats/historical/route";

const DEBOUNCE_MS = 300;
const BASE_INTERVAL = "30m";

function pickInterval(windowDays: number): string {
  if (windowDays <= 3) return "1m";
  if (windowDays <= 10) return "5m";
  return BASE_INTERVAL;
}

export function useChartZoomData(baseData: HistoricalPoolStats[]) {
  const [activeData, setActiveData] = useState<HistoricalPoolStats[] | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentInterval = useRef(BASE_INTERVAL);
  const suppressReset = useRef(false);
  const lastFetchRange = useRef<{ start: number; end: number } | null>(null);

  const onZoomChange = useCallback(
    (startPercent: number, endPercent: number) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      if (startPercent <= 0 && endPercent >= 100) {
        if (suppressReset.current) {
          suppressReset.current = false;
          return;
        }
        setActiveData(null);
        currentInterval.current = BASE_INTERVAL;
        lastFetchRange.current = null;
        return;
      }

      debounceTimer.current = setTimeout(() => {
        if (baseData.length === 0) return;

        const totalLen = baseData.length;
        const startIdx = Math.floor((startPercent / 100) * totalLen);
        const endIdx = Math.min(
          Math.ceil((endPercent / 100) * totalLen),
          totalLen - 1
        );

        const startTs = baseData[startIdx].timestamp;
        const endTs = baseData[endIdx].timestamp;
        const windowDays = (endTs - startTs) / 86400;

        const interval = pickInterval(windowDays);

        if (interval === BASE_INTERVAL) {
          setActiveData(null);
          currentInterval.current = BASE_INTERVAL;
          lastFetchRange.current = null;
          return;
        }

        if (
          interval === currentInterval.current &&
          lastFetchRange.current &&
          lastFetchRange.current.start <= startTs &&
          lastFetchRange.current.end >= endTs
        ) {
          return;
        }

        currentInterval.current = interval;

        setIsRefetching(true);

        getHistoricalPoolStats("", interval, { start: startTs, end: endTs })
          .then((data) => {
            suppressReset.current = true;
            lastFetchRange.current = { start: startTs, end: endTs };
            setActiveData(data);
          })
          .catch((err) => {
            console.error("Zoom fetch failed:", err);
          })
          .finally(() => {
            setIsRefetching(false);
          });
      }, DEBOUNCE_MS);
    },
    [baseData]
  );

  return {
    activeData: activeData ?? baseData,
    isRefetching,
    onZoomChange,
  };
}
