"use client";

import type { StratumStatus } from "@/lib/stratum-status";
import { useNow } from "../../hooks/useNow";
import { formatPreciseRelativeTime } from "../../utils/formatters";

interface StratumStatusBannerProps {
  status: StratumStatus | null;
  statusError: string | null;
  dataError: string | null;
  lastNotificationAt: number | null;
}

export default function StratumStatusBanner({
  status,
  statusError,
  dataError,
  lastNotificationAt,
}: StratumStatusBannerProps) {
  const now = useNow(1000);
  const lastTemplateText = lastNotificationAt
    ? `Last template received ${formatPreciseRelativeTime(lastNotificationAt, now)} (${new Date(lastNotificationAt * 1000).toLocaleString()}).`
    : "No template has been received yet.";
  const heartbeatText = status?.updatedAt
    ? `Collector heartbeat ${formatPreciseRelativeTime(status.updatedAt, now)}.`
    : null;
  const upstreamText = status?.host
    ? `Upstream: ${status.host}:${status.port}${status.resolvedAddress ? ` (${status.resolvedAddress})` : ""}.`
    : null;

  if (!status) {
    if (!statusError && !dataError) return null;

    return (
      <div
        className="my-4 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
        role="status"
      >
        <p className="font-medium">Stratum status unavailable</p>
        {statusError && <p className="mt-1 text-xs opacity-80">Status refresh failed: {statusError}</p>}
        {dataError && <p className="mt-1 text-xs opacity-80">Template refresh failed: {dataError}</p>}
      </div>
    );
  }

  const isConnected = status.state === "connected";
  const needsBanner =
    !isConnected ||
    status.isStale ||
    Boolean(status.lastError) ||
    Boolean(statusError) ||
    Boolean(dataError);

  if (!needsBanner) return null;

  const isError =
    status.state === "offline" ||
    status.state === "stopped" ||
    Boolean(statusError);
  const tone = isError
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";

  let title = "Stratum status";
  let detail = "Live template data is unavailable.";

  if (statusError) {
    title = "Collector status unavailable";
    detail = "The status API could not be read.";
  } else if (status.state === "offline") {
    title = "Collector offline";
    detail = "The stats collector is not running or is not reporting a heartbeat. Live template data is unavailable.";
  } else if (status.state === "stopped") {
    title = "Collector stopped";
    detail = "The stats collector has stopped. Live template data is unavailable.";
  } else if (status.state === "reconnecting") {
    title = "Upstream stratum unreachable";
    const retryAt = status.nextRetryAt;
    const retrySeconds = retryAt
      ? Math.max(0, Math.ceil(retryAt - now / 1000))
      : null;
    const retry = retryAt
      ? retrySeconds && retrySeconds > 0
        ? ` Retrying in ${retrySeconds}s (${new Date(retryAt * 1000).toLocaleTimeString()}).`
        : ` Retrying now (${new Date(retryAt * 1000).toLocaleTimeString()}).`
      : " Retrying now.";
    const attempt = status.reconnectAttempts > 0
      ? ` Attempt ${status.reconnectAttempts}.`
      : "";
    detail = `The collector is disconnected from the upstream.${retry}${attempt}`;
  } else if (status.state === "connecting") {
    title = "Connecting to upstream stratum";
    detail = "The collector is establishing its upstream connection.";
  } else if (status.state === "unknown") {
    title = "Collector status unknown";
    detail = "No collector status has been recorded yet.";
  } else if (status.isStale) {
    title = "No new block template";
    detail = "The collector is connected, but no new template has been received recently.";
  } else if (status.lastError) {
    title = "Upstream warning";
    detail = "The collector is connected but reported an upstream error.";
  } else if (dataError) {
    title = "Block template refresh failed";
    detail = "The template API could not be read.";
  }

  return (
    <div className={`my-4 border p-3 text-sm ${tone}`} role="status">
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{detail}</p>
      <p className="mt-1 text-xs opacity-80">{lastTemplateText}</p>
      {heartbeatText && <p className="mt-1 text-xs opacity-80">{heartbeatText}</p>}
      {upstreamText && <p className="mt-1 text-xs opacity-80">{upstreamText}</p>}
      {status.lastError && (
        <details className="mt-2 text-xs opacity-80">
          <summary className="cursor-pointer select-none">Last error</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words font-mono">{status.lastError}</pre>
        </details>
      )}
      {dataError && <p className="mt-1 text-xs opacity-80">Template refresh failed: {dataError}</p>}
      {statusError && <p className="mt-1 text-xs opacity-80">Status refresh failed: {statusError}</p>}
    </div>
  );
}
