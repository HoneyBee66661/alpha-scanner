import type { ClosedTrade } from "../types";
import { computeAnalytics } from "./analytics";
import type { AnalyticsMetrics } from "./analytics";

export interface AIBenchmark {
  ai: AnalyticsMetrics | null;
  rules: AnalyticsMetrics | null;
}

export function computeBenchmark(closedTrades: ClosedTrade[]): AIBenchmark {
  const aiTrades = closedTrades.filter((t) => t.trader === "ai");
  const rulesTrades = closedTrades.filter((t) => t.trader === "rules");

  return {
    ai: computeAnalytics(aiTrades),
    rules: computeAnalytics(rulesTrades),
  };
}

export function compareMetric(
  aiVal: number,
  rulesVal: number,
  higherIsBetter: boolean
): "ai" | "rules" | "tie" {
  if (aiVal === rulesVal) return "tie";
  if (higherIsBetter) return aiVal > rulesVal ? "ai" : "rules";
  return aiVal < rulesVal ? "ai" : "rules";
}

export interface ScoreAccuracy {
  model: string;
  avgEntryScore: number;
  winRateAboveMedian: number;
  winRateBelowMedian: number;
  correlation: number; // simplified: difference in win rates
}

export function computeScoreAccuracy(
  closedTrades: ClosedTrade[],
  trader: "ai" | "rules"
): ScoreAccuracy[] {
  const trades = closedTrades.filter((t) => t.trader === trader);
  if (trades.length < 6) return [];

  const models = [
    { key: "momentumSnapshot" as const, label: "Momentum" },
    { key: "smartMoneySnapshot" as const, label: "Smart Money" },
    { key: "structureSnapshot" as const, label: "Structure" },
    { key: "accumulationSnapshot" as const, label: "Accumulation" },
    { key: "sentimentSnapshot" as const, label: "Sentiment" },
    { key: "consensusSnapshot" as const, label: "Consensus" },
  ];

  return models.map(({ key, label }) => {
    const sorted = [...trades].sort((a, b) => a[key] - b[key]);
    const median = sorted[Math.floor(sorted.length / 2)][key];
    const above = sorted.filter((t) => t[key] >= median);
    const below = sorted.filter((t) => t[key] < median);

    const winAbove = above.filter((t) => t.netPnl > 0).length;
    const winBelow = below.filter((t) => t.netPnl > 0).length;
    const rateAbove = above.length > 0 ? (winAbove / above.length) * 100 : 0;
    const rateBelow = below.length > 0 ? (winBelow / below.length) * 100 : 0;

    return {
      model: label,
      avgEntryScore: Math.round(trades.reduce((s, t) => s + t[key], 0) / trades.length),
      winRateAboveMedian: Math.round(rateAbove),
      winRateBelowMedian: Math.round(rateBelow),
      correlation: Math.round((rateAbove - rateBelow) * 10) / 10,
    };
  });
}
