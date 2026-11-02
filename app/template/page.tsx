"use client";

import { useEffect, useState } from "react";
import NotificationDetails from "../components/block-template/NotificationDetails";
import StratumStatusBanner from "../components/block-template/StratumStatusBanner";
import RelativeTime from "../components/RelativeTime";
import type { StratumNotification } from "../api/stratum/route";
import type { StratumStatus } from "@/lib/stratum-status";

const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getStatusPresentation(
  status: StratumStatus | null,
  statusError: string | null,
  dataError: string | null,
) {
  if (statusError) {
    return {
      text: "Status unavailable",
      color: "text-red-400",
      dot: "bg-red-400",
    };
  }

  if (!status) {
    return dataError
      ? {
          text: "Template refresh failed",
          color: "text-yellow-400",
          dot: "bg-yellow-400",
        }
      : {
          text: "Loading...",
          color: "text-gray-400",
          dot: "bg-gray-400",
        };
  }

  switch (status.state) {
    case "connected":
      if (status.isStale || dataError || status.lastError) {
        return {
          text: status.isStale
            ? "No new template"
            : dataError
            ? "Template refresh failed"
            : "Upstream warning",
          color: "text-yellow-400",
          dot: "bg-yellow-400",
        };
      }
      return {
        text: "Connected",
        color: "text-green-400",
        dot: "bg-green-400",
      };
    case "reconnecting":
      return {
        text: "Reconnecting...",
        color: "text-yellow-400",
        dot: "bg-yellow-400 animate-pulse",
      };
    case "connecting":
      return {
        text: "Connecting...",
        color: "text-yellow-400",
        dot: "bg-yellow-400 animate-pulse",
      };
    case "offline":
      return {
        text: "Collector offline",
        color: "text-red-400",
        dot: "bg-red-400",
      };
    case "stopped":
      return {
        text: "Collector stopped",
        color: "text-red-400",
        dot: "bg-red-400",
      };
    default:
      return {
        text: "Unknown",
        color: "text-gray-400",
        dot: "bg-gray-400",
      };
  }
}

export default function BlockTemplatePage() {
  const [notification, setNotification] = useState<StratumNotification | null>(null);
  const [status, setStatus] = useState<StratumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let nextTimer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      controller?.abort();
      const currentController = new AbortController();
      controller = currentController;

      const timeout = setTimeout(
        () => currentController.abort(),
        REQUEST_TIMEOUT_MS,
      );

      const [dataResult, statusResult] = await Promise.allSettled([
        fetchJson<StratumNotification[]>("/api/stratum", currentController.signal),
        fetchJson<StratumStatus>("/api/stratum/status", currentController.signal),
      ]);

      clearTimeout(timeout);
      if (cancelled) return;

      if (dataResult.status === "fulfilled") {
        if (dataResult.value.length > 0) {
          setNotification(dataResult.value[0]);
        }
        setDataError(null);
      } else {
        setDataError(toErrorMessage(dataResult.reason, "Failed to fetch stratum data"));
      }

      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value);
        setStatusError(null);
      } else {
        setStatusError(toErrorMessage(statusResult.reason, "Failed to fetch stratum status"));
      }

      setLoading(false);
      nextTimer = setTimeout(refresh, POLL_INTERVAL_MS);
    }

    void refresh();

    return () => {
      cancelled = true;
      controller?.abort();
      if (nextTimer) clearTimeout(nextTimer);
    };
  }, []);

  const lastNotificationAt =
    Math.max(
      status?.lastNotificationAt ?? 0,
      notification?.timestamp ?? 0,
    ) || null;
  const presentation = getStatusPresentation(status, statusError, dataError);
  const isWaiting =
    status?.state === "connecting" ||
    status?.state === "reconnecting" ||
    status?.state === "connected";

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-8">
        <div className="w-full max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Block Template</h1>
            <p className="text-accent-2 mb-4">
              Waiting for Stratum V1 messages for pool: Parasite...
            </p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-3"></div>
            <span className="ml-2 text-accent-2">Loading stratum data...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-1 sm:p-4">
      <div className="w-full max-w-7xl">
        <div className="mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">
              Block Template
            </h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${presentation.dot}`}></div>
              <span className={`text-sm ${presentation.color}`}>
                {presentation.text}
              </span>
            </div>
          </div>
          <div className="text-sm text-accent-3">
            Last: <RelativeTime timestamp={lastNotificationAt} fallback="never" />
          </div>
        </div>

        <StratumStatusBanner
          status={status}
          statusError={statusError}
          dataError={dataError}
          lastNotificationAt={lastNotificationAt}
        />

        {notification ? (
          <NotificationDetails notification={notification} />
        ) : (
          <div className="text-center py-12">
            <div className="mb-4">
              {isWaiting && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-3 mx-auto mb-4"></div>
              )}
              <p className="text-accent-2 text-lg">
                {status?.state === "connected"
                  ? "Waiting for the first block template..."
                  : "No live block template data."}
              </p>
              <p className="text-sm text-accent-3 mt-2">
                {status?.host
                  ? `Upstream: ${status.host}:${status.port}`
                  : "Waiting for the stats collector."}
              </p>
              <p className="text-xs text-accent-3 mt-2">
                The pool sends new templates periodically and when a new block is found.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
