import type { ClosedTrade } from '../types/index.js';

export interface AnalyticsMetrics {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  expectancy: number;
  avgHoldHours: number;
  bestReturn: number;
  worstReturn: number;
  totalNetPnl: number;
  totalFees: number;
  winStreak: number;
  lossStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  cumulativePnl: { time: number; value: number }[];
}

export function computeAnalytics(closedTrades: ClosedTrade[]): AnalyticsMetrics | null {
  if (closedTrades.length === 0) return null;

  const wins = closedTrades.filter((t) => t.netPnl > 0);
  const losses = closedTrades.filter((t) => t.netPnl <= 0);
  const totalTrades = closedTrades.length;
  const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100) : 0;

  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length
    : 0;

  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const totalNetPnl = closedTrades.reduce((s, t) => s + t.netPnl, 0);
  const expectancy = totalTrades > 0 ? totalNetPnl / totalTrades : 0;

  const bestReturn = closedTrades.length > 0
    ? Math.max(...closedTrades.map((t) => t.netReturnPct))
    : 0;
  const worstReturn = closedTrades.length > 0
    ? Math.min(...closedTrades.map((t) => t.netReturnPct))
    : 0;

  const returns = closedTrades.map((t) => t.netReturnPct);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / Math.max(returns.length, 1);
  const std = Math.sqrt(variance);
  const sharpeRatio = std > 0 ? (avgReturn / std) * Math.sqrt(252) : 0;

  // Max drawdown from cumulative PnL curve (sorted by exit time)
  const sorted = [...closedTrades].sort((a, b) => a.exitTimestamp - b.exitTimestamp);
  const cumulativePnl: { time: number; value: number }[] = [];
  let cumPnL = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of sorted) {
    cumPnL += t.netPnl;
    cumulativePnl.push({ time: t.exitTimestamp, value: cumPnL });
    if (cumPnL > peak) peak = cumPnL;
    const dd = peak - cumPnL;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const recoveryFactor = maxDrawdown > 0 ? totalNetPnl / maxDrawdown : totalNetPnl > 0 ? Infinity : 0;

  const avgHoldHours = totalTrades > 0
    ? closedTrades.reduce((s, t) => s + (t.exitTimestamp - t.entryTimestamp) / (1000 * 60 * 60), 0) / totalTrades
    : 0;

  // Streaks (by exit time order)
  let winStreak = 0;
  let lossStreak = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  for (const t of sorted) {
    if (t.netPnl > 0) {
      winStreak++;
      lossStreak = 0;
      if (winStreak > bestWinStreak) bestWinStreak = winStreak;
    } else {
      lossStreak++;
      winStreak = 0;
      if (lossStreak > worstLossStreak) worstLossStreak = lossStreak;
    }
  }

  return {
    totalTrades,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    sharpeRatio,
    maxDrawdown,
    recoveryFactor,
    expectancy,
    avgHoldHours,
    bestReturn,
    worstReturn,
    totalNetPnl,
    totalFees: 0,
    winStreak,
    lossStreak,
    bestWinStreak,
    worstLossStreak,
    cumulativePnl,
  };
}
