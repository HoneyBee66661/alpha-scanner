import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from "react";
import type {
  ScannerView,
  PaperTrade,
  UserSettings,
  ClosedTrade,
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
import AIBenchmark from "./components/analytics/AIBenchmark";
import TokenDetailModal from "./components/scanner/TokenDetailModal";
import BacktestPopup from "./components/analytics/BacktestPopup";
import WatchlistPanel from "./components/scanner/WatchlistPanel";
import SellRecommendations from "./components/scanner/SellRecommendations";
import SettingsDrawer from "./components/settings/SettingsDrawer";
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from "./lib/watchlist";
import { fetchSignalLog, addSignalLog } from "./lib/signalLog";
import type { SignalLogEntry } from "./lib/signalLog";
import { sendTelegramAlert, formatTradeAlert } from "./lib/telegram";
import { useWebSocket } from "./hooks/useWebSocket";
import { runAutoTrader } from "./lib/autoTrader";
import type { SellRecommendation } from "./lib/sellRecommendation";
import { rankSellRecommendations, getProfitStep } from "./lib/sellRecommendation";
import { getBuyRecommendation } from "./lib/buyRecommendation";
import { backtestAllModels, buildBacktestCandles } from "./lib/backtest";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./components/auth/AuthPage";
import GamificationPanel from "./components/gamification/GamificationPanel";
import { getInitialGamificationState, computeGamification, checkNewBadges, computeLevel } from "./lib/gamification";
import type { GamificationState } from "./lib/gamification";

const LS_COLLAPSED = "ascan_nav_collapsed";
const LS_TRADES = "ascan_paper_trades";
const LS_SETTINGS = "ascan_settings";

const defaultSettings: UserSettings = {
  buyFee: 0.1,
  sellFee: 0.1,
  taxRate: 0,
  telegramBotToken: "",
  telegramChatId: "",
  autoTradeEnabled: false,
  autoTradeMaxPositions: 5,
  autoTradeBudgetPerTrade: 100,
  paperBalance: 10000,
  aiTradeEnabled: false,
  aiPaperBalance: 10000,
  aiTradeMaxPositions: 5,
  aiTradeBudgetPerTrade: 100,
};

export default function App() {
  const scanner = useScannerData();
  const { user, loading: authLoading, authenticated, isGuest, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
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
  const [backtestToken, setBacktestToken] = useState<string | null>(null);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascan_watchlist") ?? "[]"); }
    catch { return []; }
  });

  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascan_signal_log") ?? "[]"); }
    catch { return []; }
  });

  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => {
    try { return JSON.parse(localStorage.getItem("ascan_closed_trades") ?? "[]"); }
    catch { return []; }
  });

  const [gamification, setGamification] = useState<GamificationState>(() => {
    try {
      return JSON.parse(localStorage.getItem("ascan_gamification") ?? "null") ?? getInitialGamificationState();
    } catch {
      return getInitialGamificationState();
    }
  });

  const [dbReady, setDbReady] = useState(false);
  const initialLoadRef = useRef(false);
  const prevAuthenticated = useRef(authenticated);

  // Close auth modal and load data when user signs in
  useEffect(() => {
    if (authenticated && !prevAuthenticated.current) {
      setAuthModalOpen(false);
      // Load user data from Supabase
      if (isConfigured()) {
        setDbReady(false);
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
        ]).catch(() => {}).finally(() => setDbReady(true));
      }
    }
    prevAuthenticated.current = authenticated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

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

  useEffect(() => {
    localStorage.setItem("ascan_closed_trades", JSON.stringify(closedTrades));
  }, [closedTrades]);

  // Gamification: recompute XP on trade changes
  useEffect(() => {
    const updated = computeGamification(closedTrades, gamification);
    setGamification(updated);
    localStorage.setItem("ascan_gamification", JSON.stringify(updated));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedTrades.length]);

  // Gamification: check for new badges
  useEffect(() => {
    if (closedTrades.length === 0) return;
    const level = computeLevel(gamification.xp);
    const newBadges = checkNewBadges(closedTrades, gamification, level.level);
    for (const badge of newBadges) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: `Badge earned: ${badge.name}!` });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
    if (newBadges.length > 0) {
      localStorage.setItem("ascan_gamification", JSON.stringify(gamification));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedTrades.length]);

  // Auto-trader: evaluate buys and sells on each data refresh
  const autoTradeLastRun = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.autoTradeEnabled || !dbReady || loading || lastRefresh == null) return;
    if (lastRefresh === autoTradeLastRun.current) return;
    autoTradeLastRun.current = lastRefresh;

    const { buys, sells } = runAutoTrader(tokens, trades, priceMap, scoreMap, settings);

    if (buys.length === 0 && sells.length === 0) return;

    let newTrades = trades;
    let newBalance = settings.paperBalance;
    const closedTradesList: ClosedTrade[] = [];
    const logEntries: SignalLogEntry[] = [];

    // Execute sells first (free up slots + credit balance)
    for (const { trade, recommendation, currentPrice } of sells) {
      newTrades = newTrades.filter((t) => t.id !== trade.id);
      const proceeds = currentPrice * trade.quantity;
      newBalance += proceeds;

      const exitReasonMap: Record<string, ClosedTrade["exitReason"]> = {
        TAKE_PROFIT: "AUTO_TP",
        STOP_LOSS: "AUTO_SL",
        SCORE_DECAY: "AUTO_DECAY",
        TIME_EXIT: "AUTO_TIME",
        TREND_REVERSAL: "AUTO_SELL",
        VOLUME_DIVERGENCE: "AUTO_SELL",
        PROFIT_STEP: "AUTO_TP",
      };
      closedTradesList.push({
        id: trade.id,
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        exitPrice: currentPrice,
        quantity: trade.quantity,
        entryTimestamp: trade.timestamp,
        exitTimestamp: Date.now(),
        netPnl: (currentPrice - trade.entryPrice) * trade.quantity,
        netReturnPct: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
        momentumSnapshot: trade.momentumSnapshot,
        smartMoneySnapshot: trade.smartMoneySnapshot,
        structureSnapshot: trade.structureSnapshot,
        accumulationSnapshot: trade.accumulationSnapshot,
        sentimentSnapshot: trade.sentimentSnapshot,
        consensusSnapshot: trade.consensusSnapshot,
        exitReason: exitReasonMap[recommendation.action] ?? "AUTO_SELL",
        trader: trade.trader ?? "rules",
      });

      logEntries.push({
        id: Date.now(),
        symbol: trade.symbol,
        event: "AUTO_SELL",
        details: `${recommendation.action} · ${recommendation.reason} · P&L $${((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2)}`,
        timestamp: Date.now(),
      });
      if (isConfigured()) supabaseRemoveTrade(trade.id).catch(() => {});
      if (settings.telegramBotToken && settings.telegramChatId) {
        const pnl = ((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2);
        const msg = formatTradeAlert("SELL", trade.symbol, currentPrice, `${recommendation.action}: ${recommendation.reason} (P&L: $${pnl})`);
        sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
      }
    }

    // Cap buys by available balance
    const affordableBuys = buys.filter((b) => newBalance >= settings.autoTradeBudgetPerTrade);

    for (const { symbol, price, reason, score } of affordableBuys) {
      const budget = settings.autoTradeBudgetPerTrade;
      newBalance -= budget;

      const trade: PaperTrade = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        symbol,
        entryPrice: price,
        quantity: budget / price,
        timestamp: Date.now(),
        momentumSnapshot: tokens.find((t) => t.symbol === symbol)?.momentum ?? 0,
        smartMoneySnapshot: tokens.find((t) => t.symbol === symbol)?.smartMoney ?? 0,
        structureSnapshot: tokens.find((t) => t.symbol === symbol)?.structure ?? 0,
        accumulationSnapshot: tokens.find((t) => t.symbol === symbol)?.accumulation ?? 0,
        sentimentSnapshot: tokens.find((t) => t.symbol === symbol)?.sentiment ?? 0,
        consensusSnapshot: tokens.find((t) => t.symbol === symbol)?.consensus ?? 0,
        trader: "rules",
      };
      newTrades = [...newTrades, trade];
      if (isConfigured()) supabaseUpsertTrade(trade).catch(() => {});
      logEntries.push({
        id: Date.now(),
        symbol,
        event: "AUTO_BUY",
        details: `${reason} · Score ${score} · Entry $${price.toFixed(4)}`,
        timestamp: Date.now(),
      });
      if (settings.telegramBotToken && settings.telegramChatId) {
        const msg = formatTradeAlert("BUY", symbol, price, `${reason} (Score: ${score})`);
        sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
      }
    }

    // Apply all changes
    setTrades(newTrades);
    setSettings((prev) => ({ ...prev, paperBalance: newBalance }));
    if (closedTradesList.length > 0) {
      setClosedTrades((prev) => [...closedTradesList, ...prev]);
    }
    if (logEntries.length > 0) {
      setSignalLog((prev) => [...logEntries, ...prev]);
      for (const e of logEntries) {
        addSignalLog(e.symbol, e.event, e.details).catch(() => {});
      }
      const summary = [
        affordableBuys.length > 0 ? `${affordableBuys.length} buy${affordableBuys.length > 1 ? "s" : ""}` : null,
        sells.length > 0 ? `${sells.length} sell${sells.length > 1 ? "s" : ""}` : null,
        buys.length > affordableBuys.length ? `${buys.length - affordableBuys.length} skipped (low balance)` : null,
      ].filter(Boolean).join(", ");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: `Auto-trader: ${summary}` });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
  }, [lastRefresh, settings.autoTradeEnabled, dbReady, loading]);

  // Telegram recommendation alerts: periodic summary of buy/sell opportunities
  const lastRecommendationAlert = useRef<number | null>(null);
  // Track last alerted profit step per symbol (keyed by symbol, value = highest step alerted)
  const profitStepsAlerted = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!settings.telegramBotToken || !settings.telegramChatId) return;
    if (!dbReady || loading || lastRefresh == null) return;
    if (lastRefresh === lastRecommendationAlert.current) return;
    // Only alert if at least 15 min has passed since last alert (faster for profit steps)
    if (lastRecommendationAlert.current && Date.now() - lastRecommendationAlert.current < 15 * 60 * 1000) return;
    lastRecommendationAlert.current = Date.now();

    // ── BUY SIGNALS: scan entire token list ──────────────────────────
    const buyCandidates = tokens
      .map((t) => ({ token: t, rec: getBuyRecommendation(t) }))
      .filter(({ rec }) => rec.action === "STRONG_BUY" || rec.action === "BUY")
      .sort((a, b) => b.rec.score - a.rec.score)
      .slice(0, 10);

    // ── SELL SIGNALS: portfolio only with strict risk ────────────────
    const sellCandidates = rankSellRecommendations(trades, priceMap, scoreMap)
      .filter((r) => r.recommendation.action !== "HOLD")
      .slice(0, 10);

    // ── PROFIT STEP CHECK: detect new 5% increments ──────────────────
    const profitStepAlerts: { symbol: string; step: number; pctChange: number; pnl: string }[] = [];
    for (const trade of trades) {
      const currentPrice = priceMap.get(trade.symbol) ?? trade.entryPrice;
      const pctChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
      const lastAlerted = profitStepsAlerted.current.get(trade.symbol) ?? 0;
      const newStep = getProfitStep(pctChange);
      if (newStep > 0 && newStep > lastAlerted) {
        const pnl = ((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2);
        profitStepAlerts.push({ symbol: trade.symbol, step: newStep, pctChange, pnl });
        profitStepsAlerted.current.set(trade.symbol, newStep);
      }
    }

    // ── SEPARATE RISK ALERTS (SL / trend reversal / decay) ────────────
    const riskAlerts = sellCandidates.filter(
      (r) => r.recommendation.action === "STOP_LOSS" ||
             r.recommendation.action === "TREND_REVERSAL" ||
             r.recommendation.action === "SCORE_DECAY" ||
             r.recommendation.urgency === "critical" ||
             r.recommendation.urgency === "high"
    );

    if (buyCandidates.length === 0 && sellCandidates.length === 0 && profitStepAlerts.length === 0) return;

    const lines: string[] = [
      `<b>🔍 Alpha Scanner Report</b>`,
      `<i>${new Date().toLocaleString()}</i>`,
      ``,
    ];

    // ── RISK ALERTS (always first) ──────────────────────────────────
    if (riskAlerts.length > 0) {
      lines.push(`<b>🚨 RISK ALERTS — PORTFOLIO</b>`);
      for (const { trade, recommendation, currentPrice } of riskAlerts) {
        const pnl = ((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2);
        const emoji = recommendation.action === "STOP_LOSS" ? "🛑" : recommendation.action === "TREND_REVERSAL" ? "⚠️" : "📉";
        lines.push(`  ${emoji} ${trade.symbol.replace("USDT", "")} · ${recommendation.action} · ${recommendation.reason} · P&L $${pnl}`);
      }
      lines.push(``);
    }

    // ── PROFIT STEP ALERTS ──────────────────────────────────────────
    if (profitStepAlerts.length > 0) {
      lines.push(`<b>💰 PROFIT TIERS REACHED — PORTFOLIO</b>`);
      for (const ps of profitStepAlerts) {
        lines.push(`  🟢 ${ps.symbol.replace("USDT", "")} · +${ps.step}% tier · currently +${ps.pctChange.toFixed(1)}% · P&L $${ps.pnl}`);
      }
      lines.push(`  <i>Consider scaling out at each tier to lock gains</i>`);
      lines.push(``);
    }

    if (buyCandidates.length > 0) {
      lines.push(`<b>🟢 BUY SIGNALS — MARKET SCAN</b>`);
      for (const { token, rec } of buyCandidates) {
        lines.push(`  ${token.symbol.replace("USDT", "")} · Score ${rec.score} · ${rec.reason}`);
      }
      lines.push(``);
    }

    // ── SELL SIGNALS (non-risk, non-profit-step — e.g. TP, time exit) ──
    const otherSells = sellCandidates.filter(
      (r) => r.recommendation.action !== "STOP_LOSS" &&
             r.recommendation.action !== "TREND_REVERSAL" &&
             r.recommendation.action !== "SCORE_DECAY" &&
             r.recommendation.urgency !== "critical" &&
             r.recommendation.urgency !== "high"
    );
    if (otherSells.length > 0) {
      lines.push(`<b>🔴 OTHER SELL SIGNALS — PORTFOLIO</b>`);
      for (const { trade, recommendation, currentPrice } of otherSells) {
        const pnl = ((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2);
        lines.push(`  ${trade.symbol.replace("USDT", "")} · ${recommendation.action} · P&L $${pnl} · ${recommendation.reason}`);
      }
      lines.push(``);
    }

    // Backtest snippet: run against portfolio tokens only
    try {
      const heldSymbols = new Set(trades.map((t) => t.symbol));
      const btTokens = tokens.filter((t) => heldSymbols.has(t.symbol) && t.ohlcv && t.ohlcv.length > 10);
      if (btTokens.length > 0) {
        const btResults = backtestAllModels(
          buildBacktestCandles(
            btTokens.map((t) => ({
              symbol: t.symbol,
              ohlcv: t.ohlcv,
              momentum: t.momentum,
              smartMoney: t.smartMoney,
              structure: t.structure,
              accumulation: t.accumulation,
              sentiment: t.sentiment,
              mmFootprint: t.mmFootprint,
              consensus: t.consensus,
            }))
          )
        );
        if (btResults.length > 0) {
          const best = btResults.sort((a, b) => {
            const maxA = Math.max(...a.thresholdResults.map((r) => r.winRate));
            const maxB = Math.max(...b.thresholdResults.map((r) => r.winRate));
            return maxB - maxA;
          })[0];
          if (best) {
            const bestThreshold = best.thresholdResults.sort((a, b) => b.winRate - a.winRate)[0];
            if (bestThreshold && bestThreshold.trades > 0) {
              lines.push(`<b>Portfolio Backtest Insight</b>`);
              lines.push(`  Model: ${best.model} · ${bestThreshold.winRate}% win rate (threshold ${bestThreshold.threshold}) on ${btTokens.length} portfolio tokens`);
              lines.push(``);
            }
          }
        }
      }
    } catch (e) {
      // Skip backtest snippet if it fails
    }

    lines.push(`<i>Alpha Scanner · ${new Date().toLocaleString()}</i>`);

    const message = lines.join("\n");
    sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, message).catch(() => {});
  }, [lastRefresh, settings.telegramBotToken, settings.telegramChatId, dbReady, loading]);

  const priceMap = new Map<string, number>();
  const scoreMap = new Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>();
  for (const t of tokens) {
    priceMap.set(t.symbol, t.price);
    scoreMap.set(t.symbol, {
      momentum: t.momentum,
      smartMoney: t.smartMoney,
      structure: t.structure,
      accumulation: t.accumulation,
      sentiment: t.sentiment,
      mmFootprint: t.mmFootprint,
      consensus: t.consensus,
    });
  }

  async function handlePaperBuy(symbol: string) {
    const token = tokens.find((t) => t.symbol === symbol);
    if (!token) return;
    const cost = 100; // fixed $100 per manual trade
    if (settings.paperBalance < cost) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message: `Insufficient balance — need $${cost}, have $${settings.paperBalance.toFixed(2)}` });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
      return;
    }
    const trade: PaperTrade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      symbol: token.symbol,
      entryPrice: token.price,
      quantity: cost / token.price,
      timestamp: Date.now(),
      momentumSnapshot: token.momentum,
      smartMoneySnapshot: token.smartMoney,
      structureSnapshot: token.structure,
      accumulationSnapshot: token.accumulation,
      sentimentSnapshot: token.sentiment,
      consensusSnapshot: token.consensus,
      trader: "rules",
    };
    setTrades((prev) => [...prev, trade]);
    setSettings((prev) => ({ ...prev, paperBalance: prev.paperBalance - cost }));
    if (isConfigured()) {
      try { await supabaseUpsertTrade(trade); } catch (e) { console.warn("Supabase save failed", e); }
    }
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: `Bought ${symbol.replace("USDT", "")} at $${trade.entryPrice.toFixed(4)}` });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    const entry = await addSignalLog(symbol, "BUY", `Entry $${trade.entryPrice.toFixed(4)} · Consensus ${token.consensus}`);
    setSignalLog((prev) => [entry, ...prev]);
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
      const currentPrice = priceMap.get(removed.symbol) ?? removed.entryPrice;
      const proceeds = currentPrice * removed.quantity;
      setSettings((prev) => ({ ...prev, paperBalance: prev.paperBalance + proceeds }));

      // Record closed trade
      const closed: ClosedTrade = {
        id: removed.id,
        symbol: removed.symbol,
        entryPrice: removed.entryPrice,
        exitPrice: currentPrice,
        quantity: removed.quantity,
        entryTimestamp: removed.timestamp,
        exitTimestamp: Date.now(),
        netPnl: (currentPrice - removed.entryPrice) * removed.quantity,
        netReturnPct: ((currentPrice - removed.entryPrice) / removed.entryPrice) * 100,
        momentumSnapshot: removed.momentumSnapshot,
        smartMoneySnapshot: removed.smartMoneySnapshot,
        structureSnapshot: removed.structureSnapshot,
        accumulationSnapshot: removed.accumulationSnapshot,
        sentimentSnapshot: removed.sentimentSnapshot,
        consensusSnapshot: removed.consensusSnapshot,
        exitReason: "MANUAL",
        trader: removed.trader ?? "rules",
      };
      setClosedTrades((prev) => [closed, ...prev]);

      const rmEntry = await addSignalLog(removed.symbol, "REMOVE", `Manual removal · Entry was $${removed.entryPrice.toFixed(4)} · P&L $${closed.netPnl.toFixed(2)}`);
      setSignalLog((prev) => [rmEntry, ...prev]);
      if (settings.telegramBotToken && settings.telegramChatId) {
        const msg = formatTradeAlert("REMOVE", removed.symbol, removed.entryPrice, `Position manually closed · P&L $${closed.netPnl.toFixed(2)}`);
        sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
      }
    }
  }

  async function handleSell(trade: PaperTrade, rec: SellRecommendation, currentPrice: number) {
    setTrades((prev) => prev.filter((t) => t.id !== trade.id));
    const proceeds = currentPrice * trade.quantity;
    setSettings((prev) => ({ ...prev, paperBalance: prev.paperBalance + proceeds }));
    if (isConfigured()) {
      try { await supabaseRemoveTrade(trade.id); } catch (e) { console.warn("Supabase remove failed", e); }
    }

    const exitReasonMap: Record<string, ClosedTrade["exitReason"]> = {
      TAKE_PROFIT: "AUTO_TP",
      STOP_LOSS: "AUTO_SL",
      SCORE_DECAY: "AUTO_DECAY",
      TIME_EXIT: "AUTO_TIME",
      TREND_REVERSAL: "AUTO_SELL",
      VOLUME_DIVERGENCE: "AUTO_SELL",
      PROFIT_STEP: "AUTO_TP",
    };

    const closed: ClosedTrade = {
      id: trade.id,
      symbol: trade.symbol,
      entryPrice: trade.entryPrice,
      exitPrice: currentPrice,
      quantity: trade.quantity,
      entryTimestamp: trade.timestamp,
      exitTimestamp: Date.now(),
      netPnl: (currentPrice - trade.entryPrice) * trade.quantity,
      netReturnPct: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
      momentumSnapshot: trade.momentumSnapshot,
      smartMoneySnapshot: trade.smartMoneySnapshot,
      structureSnapshot: trade.structureSnapshot,
      accumulationSnapshot: trade.accumulationSnapshot,
      sentimentSnapshot: trade.sentimentSnapshot,
      consensusSnapshot: trade.consensusSnapshot,
      exitReason: exitReasonMap[rec.action] ?? "MANUAL",
      trader: trade.trader ?? "rules",
    };
    setClosedTrades((prev) => [closed, ...prev]);

    const entry = await addSignalLog(trade.symbol, "SELL", `${rec.action}: ${rec.reason} · P&L $${closed.netPnl.toFixed(2)}`);
    setSignalLog((prev) => [entry, ...prev]);

    if (settings.telegramBotToken && settings.telegramChatId) {
      const msg = formatTradeAlert("SELL", trade.symbol, currentPrice, `${rec.action}: ${rec.reason} (P&L: $${closed.netPnl.toFixed(2)})`);
      sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg).catch(() => {});
    }

    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: `Sold ${trade.symbol.replace("USDT", "")} · ${rec.action} · P&L $${closed.netPnl.toFixed(2)}` });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
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

  function handleSetBalance(newBalance: number) {
    setSettings((prev) => ({ ...prev, paperBalance: Math.max(0, newBalance) }));
  }

  const totalVol = tokens.reduce((sum, t) => sum + t.volume24h, 0);

  const sourceLabel: Record<string, string> = {
    binance: "Binance",
  };

  async function handleSignOut() {
    await signOut();
    // Clear guest session data
    localStorage.removeItem("ascan_paper_trades");
    localStorage.removeItem("ascan_settings");
    localStorage.removeItem("ascan_watchlist");
    localStorage.removeItem("ascan_signal_log");
    localStorage.removeItem("ascan_closed_trades");
    localStorage.removeItem("ascan_gamification");
    setTrades([]);
    setSettings({ ...defaultSettings });
    setWatchlist([]);
    setSignalLog([]);
    setClosedTrades([]);
    setGamification(getInitialGamificationState());
  }

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
          isGuest={isGuest}
          userEmail={user?.email}
          onSignIn={isConfigured() ? () => setAuthModalOpen(true) : undefined}
          onSignOut={authenticated ? handleSignOut : undefined}
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
                  : "Using simulated data — Binance unreachable."}
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
              onBacktest={setBacktestToken}
            />
          )}
          {view === "buy-recs" && (
            <BuyRecommendations
              tokens={tokens}
              loading={loading}
              onBuy={handlePaperBuy}
              onTokenClick={setSelectedToken}
              onBacktest={(s) => setBacktestToken(s)}
            />
          )}
          {view === "sell-recs" && (
            <SellRecommendations
              trades={trades}
              prices={priceMap}
              scores={scoreMap}
              settings={settings}
              onSell={handleSell}
              onBacktest={(s) => setBacktestToken(s)}
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
              balance={settings.paperBalance}
              onSetBalance={handleSetBalance}
              gamification={gamification}
            />
          )}
          {view === "analytics" && (
            <SignalAnalytics trades={trades} prices={priceMap} closedTrades={closedTrades} balance={settings.paperBalance} />
          )}
          {view === "signal-log" && (
            <SignalLogViewer entries={signalLog} />
          )}
          {view === "ai-benchmark" && (
            <AIBenchmark
              trades={trades}
              closedTrades={closedTrades}
              rulesBalance={settings.paperBalance}
              aiBalance={settings.aiPaperBalance}
            />
          )}
          {view === "backtest" && (
            <BacktestPanel tokens={tokens} />
          )}
          {view === "settings" && (
            <SettingsDrawer settings={settings} onSave={setSettings} onSetBalance={handleSetBalance} />
          )}
          {view === "profile" && (
            <GamificationPanel closedTrades={closedTrades} gamification={gamification} />
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

      {backtestToken && (() => {
        const token = tokens.find((t) => t.symbol === backtestToken);
        if (!token || !token.ohlcv) return null;
        return (
          <BacktestPopup
            symbol={token.symbol}
            ohlcv={token.ohlcv}
            scores={{
              momentum: token.momentum,
              smartMoney: token.smartMoney,
              structure: token.structure,
              accumulation: token.accumulation,
              sentiment: token.sentiment,
              mmFootprint: token.mmFootprint,
              consensus: token.consensus,
            }}
            onClose={() => setBacktestToken(null)}
          />
        );
      })()}

      {authModalOpen && (
        <AuthPage onClose={() => setAuthModalOpen(false)} />
      )}

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
