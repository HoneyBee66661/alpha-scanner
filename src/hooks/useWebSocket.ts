import { useEffect, useRef, useState } from "react";
import { getWS } from "../lib/websocket";
import type { TickerUpdate } from "../lib/websocket";

interface UseWebSocketOptions {
  symbols: string[];
  onTickers: (tickers: Map<string, TickerUpdate>) => void;
}

export function useWebSocket({ symbols, onTickers }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const onTickersRef = useRef(onTickers);
  onTickersRef.current = onTickers;

  useEffect(() => {
    if (!symbols.length) return;

    const ws = getWS();
    ws.subscribe(symbols);

    // Poll connection state
    const connInterval = setInterval(() => {
      setConnected(ws.connected);
    }, 2000);

    const unsub = ws.onUpdate((tickers) => {
      setConnected(ws.connected);
      onTickersRef.current(tickers);
    });

    return () => {
      clearInterval(connInterval);
      unsub();
    };
  }, [symbols]);

  return { connected };
}
