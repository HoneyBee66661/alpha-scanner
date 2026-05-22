import { useState, useEffect, useSyncExternalStore, useCallback } from "react";
import type {
  ScannerView,
  PaperTrade,
  UserSettings,
} from "./types";
import { useScannerData } from "./hooks/useScannerData";
import type { DataSource } from "./lib/dataSource";
import { saveSourcePreference } from "./lib/dataSource";
import NavSidebar from "./components/layout/NavSidebar";
import Header from "./components/layout/Header";
import TopBar from "./components/layout/TopBar";
import DataSourceToggle from "./components/scanner/DataSourceToggle";
import ScannerTable from "./components/scanner/ScannerTable";
import SmartMoneyRadar from "./components/radar/SmartMoneyRadar";
import AccumulationRadar from "./components/radar/AccumulationRadar";
import PaperPortfolio from "./components/paper/PaperPortfolio";
import SignalAnalytics from "./components/analytics/SignalAnalytics";
import BacktestPanel from "./components/analytics/BacktestPanel";
import SettingsDrawer from "./components/settings/SettingsDrawer";

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
  }, [settings]);

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

  function handlePaperBuy(symbol: string) {
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
  }

  function removeTrade(id: string) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
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
              onBuy={handlePaperBuy}
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
          {view === "backtest" && (
            <BacktestPanel tokens={tokens} />
          )}
          {view === "settings" && (
            <SettingsDrawer settings={settings} onSave={setSettings} />
          )}
        </main>
      </div>
    </div>
  );
}
