export type TickerUpdate = {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

type Listener = (tickers: Map<string, TickerUpdate>) => void;

const BINANCE_WS = "wss://stream.binance.com:9443/ws";

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private tickers = new Map<string, TickerUpdate>();
  private subscribedSymbols: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private destroyed = false;
  private generation = 0;

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get tickerCount() {
    return this.tickers.size;
  }

  subscribe(symbols: string[]) {
    this.subscribedSymbols = symbols.map((s) => s.toLowerCase().replace("usdt", ""));
    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    this.close();

    const gen = ++this.generation;

    const streams = this.subscribedSymbols.map((s) => `${s}usdt@ticker`).join("/");
    const url = `${BINANCE_WS}/${streams}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.notify();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.e === "24hrTicker") {
          const update: TickerUpdate = {
            symbol: data.s,
            price: parseFloat(data.c),
            priceChange24h: parseFloat(data.P),
            volume24h: parseFloat(data.q),
            high24h: parseFloat(data.h),
            low24h: parseFloat(data.l),
          };
          this.tickers.set(data.s, update);
          this.notify();
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };

    this.ws.onclose = () => {
      if (gen !== this.generation) return; // stale handler — ignore
      if (!this.destroyed && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      }
      this.notify();
    };
  }

  private close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
  }

  onUpdate(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.tickers));
  }

  destroy() {
    this.destroyed = true;
    this.close();
    this.listeners.clear();
    this.tickers.clear();
  }
}

// Singleton
let instance: BinanceWebSocket | null = null;

export function getWS(): BinanceWebSocket {
  if (!instance) instance = new BinanceWebSocket();
  return instance;
}

export function destroyWS() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
