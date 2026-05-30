import type { PaperTrade, Scores } from '../types/index.js';
import { computeOHLCVMetrics } from './scores.js';
import type { OHLCVMetrics } from './scores.js';

export type SellAction =
  | "HOLD"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "SCORE_DECAY"
  | "TIME_EXIT"
  | "TREND_REVERSAL"
  | "VOLUME_DIVERGENCE"
  | "PROFIT_STEP";

export type Urgency = "none" | "low" | "medium" | "high" | "critical";

export interface SellRecommendation {
  action: SellAction;
  reason: string;
  urgency: Urgency;
  pctChange: number;
  scoreDecay?: number;
  hoursHeld?: number;
}

export interface BacktestHint {
  scoreModelWinRate: number; // 0-100, how often this score range wins historically
  avgReturn: number;         // avg return % for this score range
  optimalHoldPeriods: number[]; // hold periods (in candles) with highest win rate
}

// ── Default (static) thresholds ──────────────────────────────────────────

// 5% profit step thresholds for incremental take-profit alerts
export const PROFIT_STEPS = [5, 10, 15, 20, 25, 30, 40, 50];

// Stricter TP — alert at every 5% increment to avoid rugpull
const TP_TARGETS: { threshold: number; urgency: Urgency }[] = [
  { threshold: 5, urgency: "low" },
  { threshold: 10, urgency: "medium" },
  { threshold: 15, urgency: "medium" },
  { threshold: 20, urgency: "high" },
  { threshold: 25, urgency: "high" },
  { threshold: 30, urgency: "critical" },
];

// Tighter SL — strict risk management
const SL_LEVELS: { threshold: number; urgency: Urgency }[] = [
  { threshold: -10, urgency: "critical" },
  { threshold: -5, urgency: "high" },
  { threshold: -3, urgency: "medium" },
  { threshold: -1.5, urgency: "low" },
];

// Stricter decay detection — alert sooner when score drops
const DECAY_LEVELS: { threshold: number; urgency: Urgency }[] = [
  { threshold: 25, urgency: "critical" },
  { threshold: 15, urgency: "high" },
  { threshold: 8, urgency: "medium" },
];

const MAX_HOLD_HOURS = 240; // 10 days
const WARN_HOLD_HOURS = 72; // 3 days

// ── Threshold adjustment helpers ─────────────────────────────────────────

/**
 * Adjust TP thresholds based on backtest win rate.
 * Higher historical win rate → more aggressive TP (take profit sooner).
 */
function adjustedTPTargets(
  backtestHint?: BacktestHint
): typeof TP_TARGETS {
  if (!backtestHint) return TP_TARGETS;

  const wr = backtestHint.scoreModelWinRate;
  const multiplier =
    wr >= 70 ? 0.85 :   // strong model → tighten TP
    wr >= 55 ? 0.95 :   // moderate → slight tighten
    wr >= 40 ? 1.0 :    // neutral
    1.15;                // weak model → wider TP (need more room)

  return TP_TARGETS.map((t) => ({
    threshold: Math.round(t.threshold * multiplier * 10) / 10,
    urgency: t.urgency,
  }));
}

/**
 * Adjust SL levels based on backtest avg return.
 * Higher avg return → tighter SL (we expect the model to pick winners).
 */
function adjustedSLLevels(
  backtestHint?: BacktestHint
): typeof SL_LEVELS {
  if (!backtestHint) return SL_LEVELS;

  const avgRet = backtestHint.avgReturn;
  const multiplier =
    avgRet > 5 ? 0.8 :   // strong performers → tighter SL
    avgRet > 2 ? 0.9 :
    avgRet > 0 ? 1.0 :
    1.2;                  // negative avg return → wider SL to avoid whipsaw

  return SL_LEVELS.map((s) => ({
    threshold: Math.round(s.threshold * multiplier * 10) / 10,
    urgency: s.urgency,
  }));
}

// ── Trend / Volume analysis ──────────────────────────────────────────────

interface MarketContext {
  trend: "bullish" | "bearish" | "neutral";
  /** Recent return slope normalised, positive = price rising */
  priceSlope: number;
  /** Recent volume relative to avg; >1 = above average */
  relativeVolume: number;
  /** True if price moving opposite to position */
  trendAgainstPosition: boolean;
}

function evaluateMarketContext(
  trade: PaperTrade,
  currentPrice: number,
  ohlcv?: { open: number; high: number; low: number; close: number; volume: number }[]
): MarketContext {
  if (!ohlcv || ohlcv.length < 14) {
    // Fallback: simple direction from trade entry
    const pctChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
    return {
      trend: pctChange > 2 ? "bullish" : pctChange < -2 ? "bearish" : "neutral",
      priceSlope: pctChange / 100,
      relativeVolume: 1,
      trendAgainstPosition: (pctChange < -2),
    };
  }

  const metrics = computeOHLCVMetrics(ohlcv);
  const closes = metrics.closes;
  const recent = closes.slice(-14);
  const priceSlope = recent.length >= 2
    ? (recent[recent.length - 1] - recent[0]) / recent[0]
    : 0;

  const trend = priceSlope > 0.03 ? "bullish" : priceSlope < -0.03 ? "bearish" : "neutral";
  const relativeVolume = metrics.avgVol > 0
    ? metrics.recentVol / metrics.avgVol
    : 1;

  // Trend is against the position if:
  // - We hold and price is trending down (bearish for long position)
  const trendAgainstPosition = trend === "bearish";

  return { trend, priceSlope, relativeVolume, trendAgainstPosition };
}

// ── Main recommendation ──────────────────────────────────────────────────

export function getSellRecommendation(
  trade: PaperTrade,
  currentPrice: number,
  currentScores?: Scores,
  backtestHint?: BacktestHint,
  ohlcv?: { open: number; high: number; low: number; close: number; volume: number }[],
  /** Last 5% profit step already alerted (0 = none). Avoids re-alerting. */
  lastProfitStep?: number
): SellRecommendation {
  const pctChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const hoursHeld = (Date.now() - trade.timestamp) / (1000 * 60 * 60);

  const tpTargets = adjustedTPTargets(backtestHint);
  const slLevels = adjustedSLLevels(backtestHint);
  const market = evaluateMarketContext(trade, currentPrice, ohlcv);

  // ── Stop loss (strict — highest priority) ─────────────────────────
  for (const sl of slLevels) {
    if (pctChange <= sl.threshold) {
      return {
        action: "STOP_LOSS",
        reason: `${sl.threshold}% stop breached (${pctChange.toFixed(1)}%)${market.trendAgainstPosition ? " · trend against" : ""}`,
        urgency: sl.urgency,
        pctChange,
        hoursHeld,
      };
    }
  }

  // ── 5% profit step alert (incremental take-profit) ──────────────
  // Check the NEXT profit step > lastProfitStep
  if (lastProfitStep !== undefined) {
    const nextStep = PROFIT_STEPS.find((s) => s > lastProfitStep);
    if (nextStep && pctChange >= nextStep) {
      return {
        action: "PROFIT_STEP",
        reason: `+${nextStep}% profit tier reached (${pctChange.toFixed(1)}%) — consider scaling out`,
        urgency: nextStep >= 15 ? "medium" : "low",
        pctChange,
        hoursHeld,
      };
    }
  } else {
    // No tracking — alert on the first step reached
    const reached = PROFIT_STEPS.find((s) => pctChange >= s);
    if (reached) {
      return {
        action: "PROFIT_STEP",
        reason: `+${reached}% profit reached (${pctChange.toFixed(1)}%) — secure gains`,
        urgency: reached >= 15 ? "medium" : "low",
        pctChange,
        hoursHeld,
      };
    }
  }

  // ── Trend reversal: market turning against position ───────────────
  if (market.trendAgainstPosition && pctChange < 0) {
    return {
      action: "TREND_REVERSAL",
      reason: `Trend reversed against position (trend: ${market.trend}, price: ${pctChange.toFixed(1)}%)`,
      urgency: market.relativeVolume > 1.5 ? "high" : "medium",
      pctChange,
      hoursHeld,
    };
  }

  // ── Volume divergence: high volume + price stalling / dropping ────
  if (market.relativeVolume > 1.8 && pctChange < 0) {
    return {
      action: "VOLUME_DIVERGENCE",
      reason: `High volume (${market.relativeVolume.toFixed(1)}x avg) with declining price — distribution`,
      urgency: "medium",
      pctChange,
      hoursHeld,
    };
  }

  // ── Take profit (full TP targets as safety net) ──────────────────
  for (const tp of tpTargets) {
    if (pctChange >= tp.threshold) {
      return {
        action: "TAKE_PROFIT",
        reason: `+${tp.threshold}% profit target hit (+${pctChange.toFixed(1)}%)`,
        urgency: tp.urgency,
        pctChange,
        hoursHeld,
      };
    }
  }

  // ── Score decay ──────────────────────────────────────────────────
  if (currentScores) {
    const decay = trade.consensusSnapshot - currentScores.consensus;
    for (const d of DECAY_LEVELS) {
      if (decay >= d.threshold) {
        return {
          action: "SCORE_DECAY",
          reason: `Consensus dropped ${decay}pts from entry (${trade.consensusSnapshot} → ${currentScores.consensus})`,
          urgency: d.urgency,
          pctChange,
          scoreDecay: decay,
          hoursHeld,
        };
      }
    }
  }

  // ── Time exit ────────────────────────────────────────────────────
  if (hoursHeld > MAX_HOLD_HOURS) {
    return {
      action: "TIME_EXIT",
      reason: `Held >10 days without hitting targets (${hoursHeld.toFixed(0)}h)`,
      urgency: "medium",
      pctChange,
      hoursHeld,
    };
  }

  if (hoursHeld > WARN_HOLD_HOURS && pctChange < 2) {
    return {
      action: "HOLD",
      reason: `Held ${hoursHeld.toFixed(0)}h with minimal movement — consider reviewing`,
      urgency: "low",
      pctChange,
      hoursHeld,
    };
  }

  // ── Trend warning: market neutral or mild bearish on stale trade ──
  if (hoursHeld > 24 && market.trend === "bearish" && pctChange < 1) {
    return {
      action: "HOLD",
      reason: `Bearish market pressure on position held ${hoursHeld.toFixed(0)}h — monitor closely`,
      urgency: "low",
      pctChange,
      hoursHeld,
    };
  }

  return {
    action: "HOLD",
    reason: "Within target range — continue holding",
    urgency: "none",
    pctChange,
    hoursHeld,
  };
}

// ── Portfolio-level ranking ──────────────────────────────────────────────

export interface RankedSell {
  trade: PaperTrade;
  recommendation: SellRecommendation;
  currentPrice: number;
  currentScores?: Scores;
}

/**
 * Rank all open positions by sell urgency (highest urgency first).
 * Positions that should be sold ASAP appear at the top.
 */
export function rankSellRecommendations(
  trades: PaperTrade[],
  priceMap: Map<string, number>,
  scoreMap: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>,
  ohlcvMap?: Map<string, { open: number; high: number; low: number; close: number; volume: number }[]>
): RankedSell[] {
  const urgencyRank: Record<Urgency, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  };

  const ranked: RankedSell[] = [];

  for (const trade of trades) {
    const currentPrice = priceMap.get(trade.symbol) ?? trade.entryPrice;
    const currentScores = scoreMap.get(trade.symbol);
    const ohlcv = ohlcvMap?.get(trade.symbol);

    const rec: SellRecommendation = currentScores
      ? getSellRecommendation(trade, currentPrice, currentScores as Scores, undefined, ohlcv)
      : getSellRecommendation(trade, currentPrice, undefined, undefined, ohlcv);

    ranked.push({ trade, recommendation: rec, currentPrice, currentScores: currentScores as Scores | undefined });
  }

  ranked.sort((a, b) => {
    const ua = urgencyRank[a.recommendation.urgency];
    const ub = urgencyRank[b.recommendation.urgency];
    if (ua !== ub) return ua - ub;
    // Same urgency: more negative P&L first (bigger loss = more urgent)
    return a.recommendation.pctChange - b.recommendation.pctChange;
  });

  return ranked;
}

// ── Display helpers ──────────────────────────────────────────────────────

/**
 * Get the highest 5% profit step reached (0 = none).
 * Returns: 0, 5, 10, 15, 20, 25, 30, 40, 50
 */
export function getProfitStep(pctChange: number): number {
  // Check in reverse so we return the highest step reached
  const steps = [...PROFIT_STEPS].reverse();
  for (const step of steps) {
    if (pctChange >= step) return step;
  }
  return 0;
}

/**
 * Check if a new 5% profit step has been reached vs last alerted step.
 */
export function hasNewProfitStep(pctChange: number, lastAlertedStep: number): number | null {
  const currentStep = getProfitStep(pctChange);
  if (currentStep > 0 && currentStep > lastAlertedStep) {
    return currentStep;
  }
  return null;
}

export function recommendationColor(action: SellAction): string {
  switch (action) {
    case "TAKE_PROFIT":
    case "PROFIT_STEP":
      return "text-signal-green";
    case "STOP_LOSS":
    case "SCORE_DECAY":
      return "text-signal-red";
    case "TIME_EXIT":
    case "TREND_REVERSAL":
      return "text-signal-yellow";
    case "VOLUME_DIVERGENCE":
      return "text-signal-yellow";
    default:
      return "text-text-secondary";
  }
}

export function recommendationBg(action: SellAction): string {
  switch (action) {
    case "TAKE_PROFIT":
    case "PROFIT_STEP":
      return "bg-signal-greenBg";
    case "STOP_LOSS":
    case "SCORE_DECAY":
      return "bg-signal-redBg";
    case "TIME_EXIT":
    case "TREND_REVERSAL":
      return "bg-signal-yellowBg";
    case "VOLUME_DIVERGENCE":
      return "bg-signal-yellowBg";
    default:
      return "";
  }
}

export function recLabel(action: SellAction): string {
  switch (action) {
    case "TAKE_PROFIT": return "SELL (TP)";
    case "STOP_LOSS": return "SELL (SL)";
    case "SCORE_DECAY": return "WARN";
    case "TIME_EXIT": return "EXIT";
    case "TREND_REVERSAL": return "TREND";
    case "VOLUME_DIVERGENCE": return "VOL DIV";
    case "PROFIT_STEP": return "PROFIT+";
    default: return "HOLD";
  }
}

export function urgencyBadgeClass(urgency: Urgency): string {
  switch (urgency) {
    case "critical": return "bg-signal-redBg text-signal-red";
    case "high": return "bg-signal-redBg/70 text-signal-red";
    case "medium": return "bg-signal-yellowBg text-signal-yellow";
    case "low": return "bg-white/5 text-text-muted";
    case "none": return "text-text-muted";
  }
}
