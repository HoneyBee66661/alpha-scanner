import type { OHLCV, Scores, SignalTag } from '../types/index.js';

// ── Math helpers ──────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Sigmoid that maps (0,∞) → (0,1), steep around x=1 */
function sigmoid(x: number, k = 1): number {
  return 1 / (1 + Math.exp(-k * (x - 1)));
}

/** Logarithmic scaling: prevents blow-up, compresses extremes */
function logScale(x: number, base = Math.E): number {
  return Math.log(1 + x) / Math.log(base);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[], avg?: number): number {
  if (values.length < 2) return 0;
  const m = avg ?? mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

function ema(values: number[], period: number): number {
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/** Linear regression slope over a window */
function slope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── OHLCV-derived metrics ─────────────────────────────────────────────────

interface OHLCVMetrics {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  avgVol: number;
  recentVol: number;
  prevVol: number;
  volTrend: number;      // slope of volume over window, normalized
  priceTrend: number;    // slope of price over window, normalized
  volatility: number;    // std of returns
  wickRatio: number;     // avg (high-low)/abs(close-open) — measures wickiness
  rangeCompression: number; // current range / avg range — below 1 = squeeze
  higherHighs: number;   // count of higher highs in last 5 bars (0-5)
  higherLows: number;    // count of higher lows in last 5 bars (0-5)
}

function computeOHLCVMetrics(ohlcv: OHLCV[]): OHLCVMetrics {
  const bars = ohlcv.slice(-30);
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);
  const avgVol = mean(volumes);
  const recentVol = volumes.length >= 3 ? mean(volumes.slice(-3)) : avgVol;
  const prevVol = volumes.length >= 2 ? volumes[volumes.length - 2] : avgVol;

  // Volume trend: slope of last 10 volume bars normalized by avg
  const volWindow = volumes.slice(-10);
  const rawVolSlope = slope(volWindow);
  const volTrend = avgVol > 0 ? rawVolSlope / avgVol : 0;

  const priceTrend = slope(closes);

  // Volatility: std of log returns
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const volatility = std(logReturns);

  // Wick ratio: average (high-low) / abs(close-open)
  let wickSum = 0;
  for (const b of bars) {
    const body = Math.abs(b.close - b.open);
    const range = b.high - b.low;
    wickSum += body > 0 ? (range - body) / body : (range > 0 ? 2 : 0);
  }
  const wickRatio = bars.length > 0 ? wickSum / bars.length : 0;

  // Range compression: recent 5-bar avg range / 20-bar avg range
  const ranges = bars.map((b) => b.high - b.low);
  const recentRange = ranges.length >= 5 ? mean(ranges.slice(-5)) : mean(ranges);
  const longRange = mean(ranges);
  const rangeCompression = longRange > 0 ? recentRange / longRange : 1;

  // Higher high / higher low counts
  let hh = 0, hl = 0;
  for (let i = bars.length - 5; i < bars.length; i++) {
    if (i > 0 && highs[i] > highs[i - 1]) hh++;
    if (i > 0 && lows[i] > lows[i - 1]) hl++;
  }
  const higherHighs = clamp(hh, 0, 5);
  const higherLows = clamp(hl, 0, 5);

  return { closes, highs, lows, volumes, avgVol, recentVol, prevVol, volTrend, priceTrend, volatility, wickRatio, rangeCompression, higherHighs, higherLows };
}

// ── Scoring functions ─────────────────────────────────────────────────────

/**
 * MOMENTUM SCORE (replaces Alpha)
 * Measures trend strength with volume confirmation and volatility penalty.
 * Range: 0-100
 */
export function computeMomentumScore(metrics: OHLCVMetrics, priceChange24h: number): number {
  const { avgVol, recentVol, prevVol, volTrend, priceTrend, volatility, higherHighs } = metrics;

  // 1. Relative volume (log-scaled to prevent blow-up)
  const rvol = avgVol > 0 ? recentVol / avgVol : 1;
  const rvolScore = clamp(sigmoid(rvol, 2) * 100, 0, 100); // steep sigmoid centered at 1x

  // 2. Volume acceleration (trending up = good)
  const volAccel = avgVol > 0 ? (recentVol - prevVol) / avgVol : 0;
  const accelScore = clamp(50 + volAccel * 100, 0, 100);

  // 3. Price trend strength (normalized by volatility)
  const avgPrice = mean(metrics.closes);
  const trendNorm = avgPrice > 0 && volatility > 0
    ? Math.abs(priceTrend) / (avgPrice * volatility)
    : 0;
  const trendScore = clamp(sigmoid(trendNorm * 100, 0.5) * 100, 0, 100);

  // 4. Directional alignment (price and volume moving together)
  const volPriceAlign = (priceTrend > 0 && volTrend > 0) || (priceTrend < 0 && volTrend < 0);
  const alignBonus = volPriceAlign ? 15 : -10;

  // 5. Higher highs = trending structure
  const hhScore = (higherHighs / 5) * 100;

  // 6. Volatility penalty — high vol without trend = noise
  const noiseRatio = volatility > 0 ? Math.abs(priceTrend / avgPrice) / volatility : 0;
  const noisePenalty = clamp((1 - noiseRatio) * 30, 0, 30);

  const raw = 0.30 * rvolScore + 0.20 * accelScore + 0.25 * trendScore + 0.15 * hhScore + alignBonus - noisePenalty;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * SMART MONEY SCORE
 * Uses OI delta vs price delta, funding rate gradient, and volume analysis.
 * Range: 0-100
 */
export function computeSmartMoneyScore(
  oiDelta24h: number,       // % change in open interest (e.g., 5 = +5%)
  priceDelta24h: number,    // % change in price
  fundingRate: number,      // current funding rate (e.g., 0.0001 = 0.01%)
  avgFundingRate: number,   // average funding rate over last 8h (for gradient)
  buyVolRatio: number,      // taker buy / total taker volume (0-1)
  volSpikeRatio: number,    // current vol / avg vol (for large trade detection)
): number {
  // 1. OI-Price matrix (classic smart money indicator)
  // OI↑ + Price↑ = bullish (new longs entering)
  // OI↑ + Price↓ = bearish (shorts building / longs exiting)
  // OI↓ + Price↑ = bearish (shorts covering / longs exiting)
  // OI↓ + Price↓ = bullish (capitulation / shorts covering)
  let oiPriceScore = 50;
  const oiUp = oiDelta24h > 1;
  const priceUp = priceDelta24h > 0.5;
  const oiDown = oiDelta24h < -1;
  const priceDown = priceDelta24h < -0.5;

  if (oiUp && priceUp) oiPriceScore = 75 + clamp(oiDelta24h * 0.5, 0, 15);       // bullish
  else if (oiUp && priceDown) oiPriceScore = 20 - clamp(Math.abs(priceDelta24h) * 0.3, 0, 15); // bearish
  else if (oiDown && priceUp) oiPriceScore = 30 - clamp(Math.abs(oiDelta24h) * 0.3, 0, 15);   // bearish (covering)
  else if (oiDown && priceDown) oiPriceScore = 65 + clamp(Math.abs(oiDelta24h) * 0.3, 0, 15); // capitulation
  // else neutral zone

  // 2. Funding rate signal
  // Extremely negative funding → shorts paying longs → bullish contrarian
  // Extremely positive funding → longs paying shorts → bearish / overheated
  const fundingPct = fundingRate * 100; // as percentage
  let fundingScore = 50;
  if (fundingPct < -0.05) fundingScore = 80;        // very negative = bullish
  else if (fundingPct < -0.01) fundingScore = 65;    // slightly negative
  else if (fundingPct > 0.1) fundingScore = 20;      // very positive = bearish (overheated)
  else if (fundingPct > 0.05) fundingScore = 35;     // moderately positive
  else fundingScore = 50;                             // neutral

  // Funding rate trend (is it getting more extreme or normalizing?)
  const fundingTrend = fundingRate - avgFundingRate;
  if (fundingPct < -0.01 && fundingTrend > 0) fundingScore += 5; // reversing from negative = bullish
  if (fundingPct > 0.05 && fundingTrend < 0) fundingScore += 5; // reversing from positive = bullish

  // 3. Buy/sell volume imbalance
  const buyScore = clamp(buyVolRatio * 100, 0, 100);
  // Adjust: extreme buy ratio might be manipulation
  const buyImbalanceScore = buyVolRatio > 0.8 ? 60 : buyVolRatio > 0.6 ? 70 : buyVolRatio > 0.5 ? 55 : buyVolRatio > 0.4 ? 45 : buyVolRatio > 0.2 ? 30 : 40;

  // 4. Volume spike detection (large trades proxy)
  const spikeScore = clamp(sigmoid(volSpikeRatio, 1.5) * 70 + 30, 0, 100);

  const raw = 0.30 * oiPriceScore + 0.25 * fundingScore + 0.25 * buyImbalanceScore + 0.20 * spikeScore;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * STRUCTURE SCORE (replaces Swing)
 * Measures market structure quality: S/R proximity, phase detection, breakout quality.
 * Range: 0-100
 */
export function computeStructureScore(
  metrics: OHLCVMetrics,
  priceChange24h: number,
): number {
  const { closes, highs, lows, avgVol, recentVol, volatility, higherHighs, higherLows, rangeCompression } = metrics;
  const currentPrice = closes[closes.length - 1] ?? 0;
  if (currentPrice <= 0) return 50;

  // 1. Support/Resistance proximity
  // Find nearest swing high and swing low
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const range = recentHigh - recentLow;
  let srScore = 50;
  if (range > 0) {
    const distFromHigh = (recentHigh - currentPrice) / range; // 1 = at low, 0 = at high
    // Best entry is near support (distFromHigh close to 1) but not breaking it
    if (distFromHigh > 0.8) srScore = 75;      // near support — good buy zone
    else if (distFromHigh > 0.6) srScore = 65;  // mid-low range
    else if (distFromHigh < 0.15) srScore = 30; // near resistance — risky
    else srScore = 50;                           // mid range
  }

  // 2. Market phase detection
  // Trending: HH+HL sequence with range expansion
  // Accumulation: range compression with volume dry-up
  // Distribution: range expansion with heavy volume at highs
  const isTrending = higherHighs >= 3 && rangeCompression > 1.1;
  const isAccumulating = rangeCompression < 0.8 && recentVol <= avgVol * 1.2;
  const isDistributing = rangeCompression > 1.2 && recentVol > avgVol * 1.5 && (currentPrice - recentLow) / Math.max(range, 0.0001) > 0.7;

  let phaseScore = 50;
  if (isAccumulating) phaseScore = 80;
  else if (isTrending && higherLows >= 3) phaseScore = 75;
  else if (isDistributing) phaseScore = 25;
  else if (isTrending) phaseScore = 60;

  // 3. Breakout quality
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;
  const breakoutUp = currentPrice > recentHigh * 0.98 && prevClose <= recentHigh * 0.98;
  const volSurge = avgVol > 0 ? recentVol / avgVol : 1;
  let breakoutScore = 50;
  if (breakoutUp && volSurge > 1.5) breakoutScore = 85;    // confirmed breakout
  else if (breakoutUp && volSurge > 1.0) breakoutScore = 65; // weak breakout
  else if (!breakoutUp) breakoutScore = 50;                  // no breakout

  // 4. Trend consistency (higher lows = healthy uptrend)
  const hlScore = (higherLows / 5) * 100;

  const raw = 0.25 * srScore + 0.30 * phaseScore + 0.25 * breakoutScore + 0.20 * hlScore;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * ACCUMULATION SCORE (Wyckoff-inspired)
 * Detects accumulation patterns: volume dry-up, springs, absorption, compression.
 * Range: 0-100
 */
export function computeAccumulationScore(
  metrics: OHLCVMetrics,
  oiTrendUp: number,   // OI % change (positive = OI increasing)
  fundingRate: number,
): number {
  const { avgVol, recentVol, volatility, wickRatio, rangeCompression, higherLows, lows, closes } = metrics;
  const currentPrice = closes[closes.length - 1] ?? 0;

  // 1. Volume dry-up (decreasing volume during consolidation)
  const volRatio = avgVol > 0 ? recentVol / avgVol : 1;
  const dryUpScore = volRatio < 0.7 ? 85 : volRatio < 0.9 ? 70 : volRatio < 1.1 ? 60 : volRatio < 1.5 ? 45 : 30;

  // 2. Price compression (Bollinger-like squeeze = potential energy)
  const compressionScore = rangeCompression < 0.7 ? 85 : rangeCompression < 0.85 ? 70 : rangeCompression < 1.0 ? 60 : 45;

  // 3. Spring/test detection: quick wick below range low with immediate recovery
  const recentLows = lows.slice(-5);
  const minLow = Math.min(...recentLows);
  const recoveryFromLow = minLow > 0 ? (currentPrice - minLow) / currentPrice : 0;
  const isSpring = recoveryFromLow > 0.03 && rangeCompression < 0.9;
  const springScore = isSpring ? 80 : 50;

  // 4. Wick analysis — long lower wicks = absorption/buying pressure
  let lowerWickSum = 0;
  const bars = recentLows.length;
  // we compute wick ratio from the 5 most recent bars
  const recent5 = metrics.volumes.slice(-5);
  for (let i = 0; i < Math.min(5, recent5.length); i++) {
    const idx = metrics.closes.length - 5 + i;
    if (idx < 0) continue;
    const o = closes[Math.max(0, idx - 1)];
    const c = closes[idx] ?? currentPrice;
    const l = lows[idx] ?? currentPrice;
    const bodyLow = Math.min(o, c);
    if (bodyLow > l) lowerWickSum += (bodyLow - l) / Math.max(bodyLow, 0.0001);
  }
  const lowerWickRatio = Math.min(5, recent5.length) > 0 ? lowerWickSum / Math.min(5, recent5.length) : 0;
  const absorptionScore = clamp(50 + lowerWickRatio * 50, 0, 100);

  // 5. OI trend during accumulation (OI should be declining or flat — shorts capitulating)
  const oiAccum = oiTrendUp < -3 ? 80 : oiTrendUp < 0 ? 70 : oiTrendUp < 2 ? 55 : oiTrendUp < 5 ? 40 : 25;

  // 6. Higher lows forming (cornerstone of accumulation)
  const hlScore = (higherLows / 5) * 100;

  const raw = 0.25 * dryUpScore + 0.20 * compressionScore + 0.15 * springScore + 0.15 * absorptionScore + 0.10 * oiAccum + 0.15 * hlScore;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * SENTIMENT COMPOSITE (NEW)
 * Proxy sentiment from available on-chain/perps data.
 * Range: 0-100 (higher = more bullish)
 */
export function computeSentimentScore(
  fundingRate: number,
  oiDelta24h: number,
  priceDelta24h: number,
  buyVolRatio: number,
): number {
  // 1. Funding sentiment: extreme negative = contrarian bullish
  const fundingPct = fundingRate * 100;
  let fundingSent = 50;
  if (fundingPct < -0.1) fundingSent = 90;
  else if (fundingPct < -0.05) fundingSent = 75;
  else if (fundingPct < -0.01) fundingSent = 60;
  else if (fundingPct > 0.1) fundingSent = 20;
  else if (fundingPct > 0.05) fundingSent = 35;
  else fundingSent = 50;

  // 2. OI + price momentum alignment
  let oiSent = 50;
  if (oiDelta24h > 2 && priceDelta24h > 1) oiSent = 75;
  else if (oiDelta24h > 2 && priceDelta24h < -1) oiSent = 25;
  else if (oiDelta24h < -2 && priceDelta24h > 1) oiSent = 35;
  else if (oiDelta24h < -2 && priceDelta24h < -1) oiSent = 65;
  else if (priceDelta24h > 3) oiSent = 65;
  else if (priceDelta24h < -3) oiSent = 35;

  // 3. Buy volume dominance
  const buyVolSent = clamp(buyVolRatio * 100, 0, 100);

  const raw = 0.35 * fundingSent + 0.35 * oiSent + 0.30 * buyVolSent;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * MARKET MAKER FOOTPRINT (NEW)
 * Heuristic detection of potential market maker / institutional activity.
 * Range: 0-100 (higher = more MM activity detected = likely accumulation)
 */
export function computeMMFootprint(metrics: OHLCVMetrics, currentPrice: number): number {
  const { avgVol, recentVol, volatility, wickRatio, rangeCompression, highs, lows, closes } = metrics;

  let score = 50;

  // 1. Round number clustering: price hovering near psychological levels
  const roundNum = Math.pow(10, Math.floor(Math.log10(Math.max(currentPrice, 1))));
  const distFromRound = Math.abs((currentPrice % roundNum) - roundNum / 2) / (roundNum / 2);
  const roundScore = distFromRound < 0.1 ? 20 : distFromRound < 0.3 ? 10 : 0;
  score += roundScore;

  // 2. Tight ranges with above-average volume (MM accumulating)
  if (rangeCompression < 0.8 && recentVol > avgVol * 1.2) score += 15;
  else if (rangeCompression < 0.9 && recentVol > avgVol) score += 8;

  // 3. High wick ratio (both directions) = liquidity provision
  if (wickRatio > 2.5) score += 15;
  else if (wickRatio > 1.5) score += 8;

  // 4. Volume anomaly: sudden volume spike without price movement (absorption)
  const priceChange = closes.length >= 2
    ? Math.abs((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2])
    : 0;
  const volSpike = avgVol > 0 ? recentVol / avgVol : 1;
  if (volSpike > 2 && priceChange < 0.01) score += 15;
  else if (volSpike > 1.5 && priceChange < 0.02) score += 8;

  // 5. Low volatility with normal volume = controlled market
  if (volatility < 0.005 && recentVol > avgVol * 0.8) score += 10;

  // 6. Repeated tests of same level (MM defending a price)
  const recentLows = lows.slice(-10);
  const lowClusters = new Set(recentLows.map((l) => Math.round(l / currentPrice * 100) / 100));
  if (lowClusters.size <= 3 && recentLows.length >= 8) score += 10;

  return clamp(Math.round(score), 0, 100);
}

// ── Consensus ──────────────────────────────────────────────────────────────

export function computeConsensusScore(scores: Scores): number {
  const raw =
    0.25 * scores.momentum +
    0.25 * scores.smartMoney +
    0.20 * scores.structure +
    0.15 * scores.accumulation +
    0.10 * scores.sentiment +
    0.05 * scores.mmFootprint;
  return clamp(Math.round(raw), 0, 100);
}

// ── Tag generation ─────────────────────────────────────────────────────────

export function generateTags(scores: Scores, priceChange: number): SignalTag[] {
  const tags: SignalTag[] = [];
  if (scores.smartMoney >= 70) tags.push("Smart Money");
  if (scores.accumulation >= 65) tags.push("Accumulation");
  if (scores.momentum >= 75) tags.push("Breakout");
  if (scores.momentum >= 60 && scores.smartMoney < 70 && scores.accumulation < 65) tags.push("Early Momentum");
  if (scores.structure >= 65) tags.push("Trending");
  if (scores.momentum >= 90 || priceChange > 30) tags.push("Overheated");
  if (priceChange > 40 || scores.consensus < 25) tags.push("High Risk");
  return tags;
}

// ── Re-exported utilities for data sources ─────────────────────────────────

export { computeOHLCVMetrics };
export type { OHLCVMetrics };
