import type { OHLCV, Scores, SignalTag } from "../types";

function ema(values: number[], period: number): number {
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeAlphaScore(
  currentVolume: number,
  avgVolume: number,
  currentTrades: number,
  avgTrades: number,
  prevVolume: number,
  priceChangePct: number
): number {
  if (avgVolume <= 0 || avgTrades <= 0) return 0;
  const rvol = currentVolume / avgVolume;
  const tradeGrowth = currentTrades / avgTrades;
  const volAccel = prevVolume > 0 ? currentVolume / prevVolume : 1;
  const raw = (rvol * tradeGrowth * volAccel) / (1 + Math.abs(priceChangePct));
  return clamp(Math.round(raw * 20), 0, 100);
}

export function computeSmartMoneyScore(
  oiGrowth: number,
  rvol: number,
  buyPressure: number,
  tradeGrowth: number,
  accumulationScore: number
): number {
  const raw =
    0.25 * oiGrowth +
    0.25 * rvol +
    0.20 * buyPressure +
    0.15 * tradeGrowth +
    0.15 * accumulationScore;
  return clamp(Math.round(raw), 0, 100);
}

export function computeSwingScore(
  trend: number,
  rvol: number,
  oiGrowth: number,
  higherHigh: number,
  fundingStability: number
): number {
  const raw =
    0.30 * trend +
    0.25 * rvol +
    0.20 * oiGrowth +
    0.15 * higherHigh +
    0.10 * fundingStability;
  return clamp(Math.round(raw), 0, 100);
}

export function computeAccumulationScore(
  volumeGrowthPct: number,
  priceGrowthPct: number,
  oiTrendUp: boolean,
  fundingNeutral: boolean
): number {
  const denominator = Math.max(Math.abs(priceGrowthPct), 1);
  let raw = (volumeGrowthPct / denominator) * 50;
  if (oiTrendUp) raw *= 1.3;
  if (fundingNeutral) raw *= 1.2;
  return clamp(Math.round(raw), 0, 100);
}

export function computeConsensusScore(scores: Scores): number {
  const raw =
    0.35 * scores.smartMoney +
    0.25 * scores.swing +
    0.20 * scores.alpha +
    0.20 * scores.accumulation;
  return clamp(Math.round(raw), 0, 100);
}

export function generateTags(scores: Scores, priceChange: number): SignalTag[] {
  const tags: SignalTag[] = [];
  if (scores.smartMoney >= 75) tags.push("Smart Money");
  if (scores.accumulation >= 70) tags.push("Accumulation");
  if (scores.alpha >= 80) tags.push("Breakout");
  if (scores.alpha >= 65 && scores.smartMoney < 75 && scores.accumulation < 70)
    tags.push("Early Momentum");
  if (scores.swing >= 70) tags.push("Trending");
  if (scores.alpha >= 95) tags.push("Overheated");
  if (priceChange > 40 || scores.consensus < 30) tags.push("High Risk");
  return tags;
}

export function computeTrendStrength(currentPrice: number, closes: number[]): number {
  if (closes.length < 30) return 50;
  const e = ema(closes, 30);
  if (e <= 0) return 50;
  return clamp(Math.round((currentPrice / e) * 50), 0, 100);
}

export function computeBreakoutStrength(currentPrice: number, high24h: number): number {
  if (high24h <= 0) return 50;
  return clamp(Math.round((currentPrice / high24h) * 100), 0, 100);
}

export function computeBuyPressure(takerBuyVol: number, totalVol: number): number {
  if (totalVol <= 0) return 50;
  return clamp(Math.round((takerBuyVol / totalVol) * 100), 0, 100);
}

export function computeHigherHigh(close: number, prevClose: number): number {
  return close > prevClose ? 100 : 30;
}

export function computeFundingStability(fundingRate: number): number {
  return Math.abs(fundingRate) < 0.01 ? 100 : 50;
}

export function computeVolumeAverages(
  history: OHLCV[],
  periods: number
): { avgVolume: number; avgTrades: number; prevVolume: number } {
  const vols = history.slice(-periods).map((c) => c.volume);
  return {
    avgVolume: vols.length > 1 ? avg(vols.slice(0, -1)) : vols[0] ?? 0,
    avgTrades: 0,
    prevVolume: vols.length >= 2 ? vols[vols.length - 2] : vols[0] ?? 0,
  };
}
