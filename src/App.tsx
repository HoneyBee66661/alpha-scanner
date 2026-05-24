import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from "react";
import type {
  ScannerView,
  PaperTrade,
  UserSettings,
} from "./types";
import { useScannerData } from "./hooks/useScannerData";
import type { DataSource } from "./lib/dataSource";
import { saveSourcePreference } from "./lib/dataSource";
import {
  fetchTrades as supabaseFetchTrades,
  upsertTrade as supabaseUpsertTrade,
  removeTrade as supabaseRemoveTrade,
  fetchSettings as supabaseFetchSettings,
  upsertSettings as supabaseUpsertSettings,
  isConfigured,
} from "./lib/supabase";
import NavSidebar from "./components/layout/NavSidebar";
import Header from "./components/layout/Header";
import TopBar from "./components/layout/TopBar";
import DataSourceToggle from "./components/scanner/DataSourceToggle";
import ScannerTable from "./components/scanner/ScannerTable";
import BuyRecommendations from "./components/radar/BuyRecommendations";
import SmartMoneyRadar from "./components/radar/SmartMoneyRadar";
import AccumulationRadar from "./components/radar/AccumulationRadar";
import PaperPortfolio from "./components/paper/PaperPortfolio";
import SignalLogViewer from "./components/analytics/SignalLog";
import SignalAnalytics from "./components/analytics/SignalAnalytics";
import BacktestPanel from "./components/analytics/BacktestPanel";
import TokenDetailModal from "./components/scanner/TokenDetailModal";
import WatchlistPanel from "./components/scanner/WatchlistPanel";
import SettingsDrawer from "./components/settings/SettingsDrawer";
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from "./lib/watchlist";
import { fetchSignalLog, addSignalLog } from "./lib/signalLog";
import type { SignalLogEntry } from "./lib/signalLog";
import { sendTelegramAlert, formatTradeAlert } from "./lib/telegram";
import { useWebSocket } from "./hooks/useWebSocket";

const LS_COLLAPSED = "ascan_nav_collapsed";
const LS_TRADES = "ascan_paper_trades";
const LS_SETTINGS = "ascan_settings";

const defaultSettings: UserSettings = {
  buyFee: 0.1,
  sellFee: 0.1,
  taxRate: 0,
  telegramBotToken: "",
  telegramChatId: "",
};

export default function App() {
  const scanner = useScannerData();
  const [view, setView] = useState<ScannerView>("scanner");
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(LS_COLLAPSED) === "1";
  });

  const subscribe = useCallback((cb: () => void) => scanner.subscribe(cb), [scanner]);

  const tokens = useSyncExternalStore(subscribe, scanner.getSnapshot);
  const loading = useSyncExternalStore(subscribe, scanner.getLoading);
  const lastRefresh = useSyncExternalStore(subscribe, scanner.getLastRefresh);
  const fetchError = useSyncExternalStore(subscribe, scanner.getError);
  const isMock = useSyncExternalStore(subscribe, scanner.getIsMock);
  const activeSource = useSyncExternalStore(subscribe, scanner.getActiveSource);

  // Real-time price updates via Binance WebSocket
  const { connected: wsConnected } = useWebSocket({
    symbols: tokens.map((t) => t.symbol),
    onTickers: (tickers) => {
      scanner.patchPrices(tickers);
    },
  });

  const [trades, setTrades] = useState<PaperTrade[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_TRADES) ?? "[]");
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(LS_SETTINGS) ?? "{}") };
    } catch {
      return { ...defaultSettings };
    }
  });

  const [toast, setToast] = useState<{ message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascan_watchlist") ?? "[]"); }
    catch { return []; }
  });

  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascan_signal_log") ?? "[]"); }
    catch { return []; }
  });

  const [dbReady, setDbReady] = useState(false);
  const initialLoadRef = useRef(false);

  // Load from Supabase on mount, fall back to localStorage
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    if (!isConfigured()) {
      setDbReady(true);
      return;
    }

    Promise.all([
      supabaseFetchTrades().then((data) => {
        if (data.length > 0) setTrades(data);
      }),
      supabaseFetchSettings().then((s) => {
        if (s) setSettings(s);
      }),
      fetchWatchlist().then((data) => {
        if (data.length > 0) setWatchlist(data);
      }),
      fetchSignalLog().then((data) => {
        if (data.length > 0) setSignalLog(data);
      }),
    ]).catch(() => {
      // Supabase unreachable — keep localStorage values
    }).finally(() => setDbReady(true));
  }, []);

  function handleSourceChange(source: DataSource) {
    saveSourcePreference(source);
    scanner.setSource(source);
  }

  useEffect(() => {
    localStorage.setItem(LS_COLLAPSED, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(LS_TRADES, JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    if (dbReady && isConfigured()) {
      supabaseUpsertSettings(settings).catch((e) => console.warn("Supabase settings save failed", e));
    }
  }, [settings, dbReady]);

  const priceMap = new Map<string, number>();
  const scoreMap = new Map<string, { alpha: number; smartMoney: number; swing: number; accumulation: number; consensus: number }>();
  for (const t of tokens) {
    priceMap.set(t.symbol, t.price);
    scoreMap.set(t.symbol, {
      alpha: t.alpha,
      smartMoney: t.smartMoney,
      swing: t.swing,
      accumulation: t.accumulation,
      consensus: t.consensus,
    });
  }

  async function handlePaperBuy(symbol: string) {
    const token = tokens.find((t) => t.symbol === symbol);
    if (!token) return;
    const trade: PaperTrade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      symbol: token.symbol,
      entryPrice: token.price,
      quantity: 100 / token.price,
      timestamp: Date.now(),
      alphaSnapshot: token.alpha,
      smartMoneySnapshot: token.smartMoney,
      swingSnapshot: token.swing,
      consensusSnapshot: token.consensus,
    };
    setTrades((prev) => [...prev, trade]);
    if (isConfigured()) {
      try { await supabaseUpsertTrade(trade); } catch (e) { console.warn("Supabase save failed", e); }
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: `Bought ${symbol.replace("USDT", "")} at $${trade.entryPrice.toFixed(4)}` });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    // Log signal
    const entry = await addSignalLog(symbol, "BUY", `Entry $${trade.entryPrice.toFixed(4)} · Consensus ${token.consensus}`);
    setSignalLog((prev) => [entry, ...prev]);
    // Telegram alert
    if (settings.telegramBotToken && settings.telegramChatId) {
      const msg = formatTradeAlert("BUY", symbol, trade.entryPrice, `Consensus ${token.consensus}`);
      sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
    }
  }

  async function removeTrade(id: string) {
    const removed = trades.find((t) => t.id === id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
    if (isConfigured()) {
      try { await supabaseRemoveTrade(id); } catch (e) { console.warn("Supabase remove failed", e); }
    }
    if (removed) {
      const rmEntry = await addSignalLog(removed.symbol, "REMOVE", `Manual removal · Entry was $${removed.entryPrice.toFixed(4)}`);
      setSignalLog((prev) => [rmEntry, ...prev]);
      if (settings.telegramBotToken && settings.telegramChatId) {
        const msg = formatTradeAlert("REMOVE", removed.symbol, removed.entryPrice, "Position manually closed");
        sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
      }
    }
  }

  async function toggleWatchlist(symbol: string) {
    const inList = watchlist.includes(symbol);
    if (inList) {
      setWatchlist((prev) => prev.filter((s) => s !== symbol));
      await removeFromWatchlist(symbol);
    } else {
      setWatchlist((prev) => [...prev, symbol]);
      await addToWatchlist(symbol);
    }
  }

  const totalVol = tokens.reduce((sum, t) => sum + t.volume24h, 0);

  const sourceLabel: Record<string, string> = {
    binance: "Binance",
    coingecko: "CoinGecko",
    auto: "Auto",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base text-text-primary">
      <NavSidebar
        view={view}
        collapsed={collapsed}
        onViewChange={setView}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        openTradeCount={trades.length}
        watchlistCount={watchlist.length}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Header
          loading={loading}
          lastRefresh={lastRefresh}
          onRefresh={() => scanner.refresh()}
        >
          <DataSourceToggle
            value={scanner.getSource()}
            onChange={handleSourceChange}
            activeSource={activeSource}
            isMock={isMock}
          />
        </Header>

        <TopBar
          stats={[
            { label: "Live", value: wsConnected ? "●" : "○", valueClass: wsConnected ? "text-signal-green" : "text-text-muted" },
            { label: "Source", value: `${sourceLabel[activeSource] ?? "--"}${isMock ? " (sim)" : ""}` },
            { label: "Tokens", value: String(tokens.length) },
            { label: "24h Vol", value: `$${(totalVol / 1e9).toFixed(2)}B` },
            { label: "Signals > 85", value: String(tokens.filter((t) => t.consensus >= 85).length) },
          ]}
        />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isMock && !loading && (
            <div className="flex items-center gap-2 px-4 py-2 bg-signal-yellowBg border-b border-signal-yellow/30 text-signal-yellow text-cell">
              <span>!</span>
              <span>
                {fetchError
                  ? `${fetchError} Using simulated data.`
                  : `Using simulated data — ${activeSource === "binance" ? "Binance" : activeSource === "coingecko" ? "CoinGecko" : "both APIs"} unreachable.`}
              </span>
              <button
                onClick={() => scanner.refresh()}
                className="ml-auto underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          {fetchError && !isMock && !loading && tokens.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-signal-redBg border-b border-signal-red/30 text-signal-red text-cell">
              <span>!</span>
              <span>{fetchError}</span>
              <button
                onClick={() => scanner.refresh()}
                className="ml-auto underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          {view === "scanner" && (
            <ScannerTable
              tokens={tokens}
              loading={loading}
              watchlist={watchlist}
              onBuy={handlePaperBuy}
              onToggleWatchlist={toggleWatchlist}
              onTokenClick={setSelectedToken}
            />
          )}
          {view === "buy-recs" && (
            <BuyRecommendations
              tokens={tokens}
              loading={loading}
              onBuy={handlePaperBuy}
              onTokenClick={setSelectedToken}
            />
          )}
          {view === "watchlist" && (
            <WatchlistPanel
              tokens={tokens}
              watchlist={watchlist}
              loading={loading}
              onBuy={handlePaperBuy}
              onRemoveFromWatchlist={(s) => toggleWatchlist(s)}
            />
          )}
          {view === "smart-money" && <SmartMoneyRadar tokens={tokens} loading={loading} />}
          {view === "accumulation" && <AccumulationRadar tokens={tokens} loading={loading} />}
          {view === "portfolio" && (
            <PaperPortfolio
              trades={trades}
              prices={priceMap}
              settings={settings}
              scores={scoreMap}
              onRemove={removeTrade}
            />
          )}
          {view === "analytics" && (
            <SignalAnalytics trades={trades} prices={priceMap} />
          )}
          {view === "signal-log" && (
            <SignalLogViewer entries={signalLog} />
          )}
          {view === "backtest" && (
            <BacktestPanel tokens={tokens} />
          )}
          {view === "settings" && (
            <SettingsDrawer settings={settings} onSave={setSettings} />
          )}
        </main>
      </div>

      {selectedToken && (() => {
        const token = tokens.find((t) => t.symbol === selectedToken);
        if (!token) return null;
        return (
          <TokenDetailModal
            token={token}
            onClose={() => setSelectedToken(null)}
          />
        );
      })()}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="flex items-center gap-2 rounded-lg bg-signal-greenBg border border-signal-green/40 px-4 py-3 shadow-lg text-sm text-signal-green font-semibold">
            <span>+</span>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
