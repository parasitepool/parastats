'use client';

import { useCallback, useEffect, useState } from 'react';

interface ResourceRequestCallbacks<T> {
  onData: (data: T) => void;
  onError: () => void;
  onSettled: () => void;
}

// Coordinates requests independently of React so polling and manual refreshes
// cannot race. Regular polls share the active request; a manual refresh can
// supersede it, with stale responses ignored even if abort is not honored.
export class RefineryRequestManager {
  private activeRequest: { id: number; controller: AbortController } | null = null;
  private nextRequestId = 0;

  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  cancel() {
    this.activeRequest?.controller.abort();
    this.activeRequest = null;
  }

  async request<T>(url: string, force: boolean, callbacks: ResourceRequestCallbacks<T>): Promise<void> {
    if (this.activeRequest) {
      if (!force) return;
      this.cancel();
    }

    const id = ++this.nextRequestId;
    const controller = new AbortController();
    this.activeRequest = { id, controller };

    try {
      const response = await this.fetcher(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Resource unavailable');
      const data = await response.json() as T;
      if (this.activeRequest?.id === id) {
        callbacks.onData(data);
      }
    } catch {
      if (this.activeRequest?.id === id) callbacks.onError();
    } finally {
      if (this.activeRequest?.id === id) {
        this.activeRequest = null;
        callbacks.onSettled();
      }
    }
  }
}

export function useRefineryResource<T>(url: string | null, enabled = true, intervalMs = 30_000) {
  const [manager] = useState(() => new RefineryRequestManager());
  const [data, setData] = useState<T | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(Boolean(url && enabled));

  const request = useCallback(async (force: boolean) => {
    if (!url || !enabled) return;
    await manager.request<T>(url, force, {
      onData: next => {
        setData(next);
        setUnavailable(false);
      },
      onError: () => setUnavailable(true),
      onSettled: () => setLoading(false),
    });
  }, [enabled, manager, url]);

  useEffect(() => {
    manager.cancel();
    setData(null);
    setUnavailable(false);
    setLoading(Boolean(url && enabled));
    if (!url || !enabled) return;

    void request(false);
    const interval = setInterval(() => void request(false), intervalMs);
    return () => {
      clearInterval(interval);
      manager.cancel();
    };
  }, [enabled, intervalMs, manager, request, url]);

  const refresh = useCallback(() => request(true), [request]);

  return { data, unavailable, loading, refresh };
}
