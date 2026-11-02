"use client";

import { useNow } from "../hooks/useNow";
import { formatPreciseRelativeTime } from "../utils/formatters";

interface RelativeTimeProps {
  timestamp: number | null;
  fallback?: string;
}

export default function RelativeTime({
  timestamp,
  fallback = "never",
}: RelativeTimeProps) {
  const now = useNow(1000);

  return <>{timestamp ? formatPreciseRelativeTime(timestamp, now) : fallback}</>;
}
