import type { OHLCV } from "../types";

interface OHLCVWithScores extends OHLCV {
  alpha: number;
  smartMoney: number;
  swing: number;
  accumulation: number;
  consensus: number;
}

export type ScoreModel = "alpha" | "smartMoney" | "swing" | "accumulation" | "consensus";

export interface BacktestParams {
  model: ScoreModel;
  thresholds: number[];
  holdPeriods: number[]; // in candles
}

export interface ThresholdResult {
  threshold: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  avgReturn1h: number;
  avgReturn4h: number;
  avgReturn24h: number;
}

export interface BacktestResult {
  model: ScoreModel;
  totalCandles: number;
  thresholdResults: ThresholdResult[];
}

function getScore(candle: OHLCVWithScores, model: ScoreModel): number {
  switch (model) {
    case "alpha":
      return candle.alpha;
    case "smartMoney":
      return candle.smartMoney;
    case "swing":
      return candle.swing;
    case "accumulation":
      return candle.accumulation;
    case "consensus":
      return candle.consensus;
  }
}

export function runBacktest(
  candles: OHLCVWithScores[],
  params: BacktestParams
): BacktestResult {
  const thresholdResults: ThresholdResult[] = params.thresholds.map((threshold) => {
    const trades: { entry: number; exitIdx: number; exit: number }[] = [];
    let lastEntryIdx = -1;

    for (let i = 0; i < candles.length; i++) {
      // Don't enter a new trade if we're within hold period of the last one
      if (lastEntryIdx >= 0 && i - lastEntryIdx < Math.min(...params.holdPeriods)) continue;

      const score = getScore(candles[i], params.model);
      if (score >= threshold) {
        const entryPrice = candles[i].close;
        lastEntryIdx = i;

        for (const hp of params.holdPeriods) {
          const exitIdx = i + hp;
          if (exitIdx < candles.length) {
            trades.push({
              entry: entryPrice,
              exitIdx,
              exit: candles[exitIdx].close,
            });
          }
        }
        break; // Only one entry per threshold test
      }
    }

    const returns = trades.map((t) => ((t.exit - t.entry) / t.entry) * 100);
    const wins = returns.filter((r) => r > 0).length;

    // Calculate returns at specific time intervals
    const ret1h = trades.filter((t) => t.exitIdx - lastEntryIdx <= 12).map((t) => ((t.exit - t.entry) / t.entry) * 100);
    const ret4h = trades.filter((t) => t.exitIdx - lastEntryIdx <= 48).map((t) => ((t.exit - t.entry) / t.entry) * 100);
    const ret24h = trades.map((t) => ((t.exit - t.entry) / t.entry) * 100); // All exits are within 24h equivalent

    return {
      threshold,
      trades: trades.length,
      winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
      avgReturn: trades.length > 0 ? parseFloat((returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2)) : 0,
      bestReturn: trades.length > 0 ? parseFloat(Math.max(...returns).toFixed(2)) : 0,
      worstReturn: trades.length > 0 ? parseFloat(Math.min(...returns).toFixed(2)) : 0,
      avgReturn1h: ret1h.length > 0 ? parseFloat((ret1h.reduce((a, b) => a + b, 0) / ret1h.length).toFixed(2)) : 0,
      avgReturn4h: ret4h.length > 0 ? parseFloat((ret4h.reduce((a, b) => a + b, 0) / ret4h.length).toFixed(2)) : 0,
      avgReturn24h: ret24h.length > 0 ? parseFloat((ret24h.reduce((a, b) => a + b, 0) / ret24h.length).toFixed(2)) : 0,
    };
  });

  return {
    model: params.model,
    totalCandles: candles.length,
    thresholdResults,
  };
}

export function backtestAllModels(
  tokens: { symbol: string; ohlcv: OHLCVWithScores[] }[]
): BacktestResult[] {
  const models: ScoreModel[] = ["alpha", "smartMoney", "swing", "accumulation", "consensus"];
  const thresholds = [60, 70, 75, 80, 85, 90];
  const holdPeriods = [1, 3, 6, 12, 24];

  const allResults: BacktestResult[] = [];

  for (const model of models) {
    // Aggregate all candles from all tokens
    const allCandles: OHLCVWithScores[] = [];
    for (const token of tokens) {
      for (const candle of token.ohlcv) {
        allCandles.push(candle);
      }
    }

    if (allCandles.length < 10) continue;

    allResults.push(
      runBacktest(allCandles, { model, thresholds, holdPeriods })
    );
  }

  return allResults;
}

export function buildBacktestCandles(
  tokens: { symbol: string; ohlcv: OHLCV[]; alpha: number; smartMoney: number; swing: number; accumulation: number; consensus: number }[]
): { symbol: string; ohlcv: OHLCVWithScores[] }[] {
  return tokens.map((t) => ({
    symbol: t.symbol,
    ohlcv: t.ohlcv.map((c) => ({
      ...c,
      alpha: t.alpha,
      smartMoney: t.smartMoney,
      swing: t.swing,
      accumulation: t.accumulation,
      consensus: t.consensus,
    })),
  }));
}
