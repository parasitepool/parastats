'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderSummary } from '@/app/api/refinery/types';
import { fetchOrdersPage } from '@/app/utils/refinery-orders';

const REFRESH_INTERVAL_MS = 30_000;

export interface PaginatedRefineryOrders {
  orders: OrderSummary[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  unavailable: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadPrevious: () => Promise<void>;
}

export function usePaginatedRefineryOrders(
  url: string | null,
  enabled = true,
  intervalMs = REFRESH_INTERVAL_MS,
): PaginatedRefineryOrders {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url && enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const pageRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);
  const cursorHistory = useRef<Array<string | null>>([null]);
  const requestId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const requestPage = useCallback(async (cursor: string | null, targetPage: number, force: boolean) => {
    if (!url || !enabled) return;
    if (!force && activeRequest.current) return;

    const id = ++requestId.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoadingMore(targetPage !== pageRef.current);

    try {
      const result = await fetchOrdersPage(url, cursor, controller.signal);
      if (requestId.current !== id) return;

      const history = cursorHistory.current.slice(0, targetPage + 1);
      history[targetPage] = cursor;
      cursorHistory.current = history;
      pageRef.current = targetPage;
      nextCursorRef.current = result.nextCursor;
      setOrders(result.orders);
      setPage(targetPage);
      setNextCursor(result.nextCursor);
      setUnavailable(false);
    } catch {
      if (requestId.current === id) setUnavailable(true);
    } finally {
      if (requestId.current === id) {
        activeRequest.current = null;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [enabled, url]);

  const refresh = useCallback(
    () => requestPage(cursorHistory.current[pageRef.current] ?? null, pageRef.current, true),
    [requestPage],
  );

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (cursor) await requestPage(cursor, pageRef.current + 1, true);
  }, [requestPage]);

  const loadPrevious = useCallback(async () => {
    const targetPage = pageRef.current - 1;
    if (targetPage < 0) return;
    await requestPage(cursorHistory.current[targetPage] ?? null, targetPage, true);
  }, [requestPage]);

  useEffect(() => {
    const requestVersion = requestId;
    requestVersion.current++;
    activeRequest.current?.abort();
    activeRequest.current = null;
    pageRef.current = 0;
    nextCursorRef.current = null;
    cursorHistory.current = [null];
    setOrders([]);
    setPage(0);
    setNextCursor(null);
    setLoading(Boolean(url && enabled));
    setLoadingMore(false);
    setUnavailable(false);

    if (!url || !enabled) return;

    void requestPage(null, 0, false);
    const interval = setInterval(() => {
      void requestPage(cursorHistory.current[pageRef.current] ?? null, pageRef.current, false);
    }, intervalMs);

    return () => {
      clearInterval(interval);
      requestVersion.current++;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [enabled, intervalMs, requestPage, url]);

  return {
    orders,
    page,
    hasMore: Boolean(nextCursor),
    loading,
    loadingMore,
    unavailable,
    refresh,
    loadMore,
    loadPrevious,
  };
}
