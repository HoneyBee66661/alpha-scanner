import { useEffect, useRef } from "react";
import type { TokenRow } from "../types";
import { fetchFromSource, loadSourcePreference } from "../lib/dataSource";
import type { DataSource } from "../lib/dataSource";

const REFRESH_MS = 5 * 60 * 1000;

export function useScannerData() {
  const tokensRef = useRef<TokenRow[]>([]);
  const listenersRef = useRef<Set<() => void>>(new Set());
  const loadingRef = useRef(false);
  const lastRefreshRef = useRef<number | null>(null);
  const errorRef = useRef<string | null>(null);
  const isMockRef = useRef(false);
  const sourceRef = useRef<DataSource>(loadSourcePreference());
  const activeSourceRef = useRef<DataSource>("binance");

  function subscribe(fn: () => void) {
    listenersRef.current.add(fn);
    fn();
    return () => { listenersRef.current.delete(fn); };
  }

  function getSnapshot() {
    return tokensRef.current;
  }

  function getLoading() {
    return loadingRef.current;
  }

  function getLastRefresh() {
    return lastRefreshRef.current;
  }

  function getError() {
    return errorRef.current;
  }

  function getIsMock() {
    return isMockRef.current;
  }

  function getSource() {
    return sourceRef.current;
  }

  function getActiveSource() {
    return activeSourceRef.current;
  }

  function notify() {
    listenersRef.current.forEach((fn) => fn());
  }

  async function refresh() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    errorRef.current = null;
    notify();
    try {
      const result = await fetchFromSource(sourceRef.current);
      tokensRef.current = result.tokens;
      lastRefreshRef.current = Date.now();
      errorRef.current = result.isMock ? result.error ?? null : null;
      isMockRef.current = result.isMock;
      activeSourceRef.current = result.source;
    } catch (err) {
      console.error("Scanner refresh failed:", err);
      errorRef.current = err instanceof Error ? err.message : "Unexpected error";
    } finally {
      loadingRef.current = false;
      notify();
    }
  }

  function setSource(source: DataSource) {
    sourceRef.current = source;
    refresh();
  }

  function patchPrices(updates: Map<string, { price: number; priceChange24h: number; volume24h: number; high24h: number; low24h: number }>) {
    const current = tokensRef.current;
    let changed = false;
    const next = current.map((t) => {
      const u = updates.get(t.symbol);
      if (!u) return t;
      changed = true;
      return { ...t, ...u };
    });
    if (changed) {
      tokensRef.current = next;
      notify();
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    getSnapshot,
    subscribe,
    refresh,
    getLoading,
    getLastRefresh,
    getError,
    getIsMock,
    getSource,
    getActiveSource,
    setSource,
    patchPrices,
  };
}
