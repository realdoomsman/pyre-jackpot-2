import { useCallback, useEffect, useRef, useState } from "react";
import { call, describeError } from "./api";
import type { FeedItem, FeedResult } from "./types";

export type BoardStatus = "loading" | "ready" | "error";

export interface Board {
  status: BoardStatus;
  error: string | null;
  data: FeedResult | null;
  items: FeedItem[];
  category: string | null;
  setCategory: (category: string | null) => void;
  /** Server clock minus browser clock, so countdowns do not drift with a wrong local clock. */
  skew: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

const PAGE = 12;

/** Loads `functions/feed.js`: one page at a time, plus the whole board's record. */
export function useBoard(): Board {
  const [category, setCategoryState] = useState<string | null>(null);
  const [data, setData] = useState<FeedResult | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<BoardStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skew, setSkew] = useState(0);
  const [nonce, setNonce] = useState(0);
  // Only the newest request may write state: filters and reloads can overlap.
  const request = useRef(0);

  const fetchPage = useCallback(
    async (offset: number): Promise<void> => {
      const ticket = request.current + 1;
      request.current = ticket;
      if (offset === 0) {
        setStatus("loading");
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await call<FeedResult>("feed", { category, offset, limit: PAGE });
        if (request.current !== ticket) return;
        setData(result);
        setSkew(result.now - Date.now());
        setItems((previous) => (offset === 0 ? result.items : [...previous, ...result.items]));
        setStatus("ready");
      } catch (cause) {
        if (request.current !== ticket) return;
        setError(describeError(cause));
        setStatus("error");
      } finally {
        if (request.current === ticket) setLoadingMore(false);
      }
    },
    [category],
  );

  useEffect(() => {
    void fetchPage(0);
  }, [fetchPage, nonce]);

  const setCategory = useCallback((next: string | null) => {
    setItems([]);
    setCategoryState(next);
  }, []);

  return {
    status,
    error,
    data,
    items,
    category,
    setCategory,
    skew,
    hasMore: data !== null && items.length < data.total,
    loadingMore,
    loadMore: () => {
      void fetchPage(items.length);
    },
    reload: () => setNonce((n) => n + 1),
  };
}

/** Re-renders on a tick so countdowns move; `skew` corrects the browser clock. */
export function useNow(skew: number, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    setNow(Date.now() + skew);
    const timer = window.setInterval(() => setNow(Date.now() + skew), intervalMs);
    return () => window.clearInterval(timer);
  }, [skew, intervalMs]);
  return now;
}
