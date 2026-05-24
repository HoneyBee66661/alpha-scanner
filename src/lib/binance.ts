import type {
  TokenSnapshot,
  FuturesData,
  TokenRow,
  OHLCV,
} from "../types";
import { STABLECOINS, EXCLUDED_TOKENS } from "../types";
import {
  computeAlphaScore,
  computeSmartMoneyScore,
  computeSwingScore,
  computeAccumulationScore,
  computeConsensusScore,
  computeTrendStrength,
  computeBreakoutStrength,
  computeBuyPressure,
  computeHigherHigh,
  computeFundingStability,
  generateTags,
} from "./scores";

const BINANCE_SPOT = "https://api.binance.com/api/v3";
const BINANCE_FUTURES = "https://fapi.binance.com/api/v1";

async function fetchOHLCV(symbol: string, limit = 50): Promise<OHLCV[]> {
  try {
    const res = await fetch(
      `${BINANCE_SPOT}/klines?symbol=${symbol}&interval=5m&limit=${limit}`
    );
    if (!res.ok) return [];
    const raw: unknown[] = await res.json();
    return Array.isArray(raw)
      ? raw.map((c: unknown) => {
          const r = c as (string | number)[];
          return {
            open: Number(r[1]),
            high: Number(r[2]),
            low: Number(r[3]),
            close: Number(r[4]),
            volume: Number(r[5]),
          };
        })
      : [];
  } catch {
    return [];
  }
}

async function fetchFutures(symbol: string): Promise<FuturesData | null> {
  try {
    const [oiRes, fundingRes] = await Promise.all([
      fetch(`${BINANCE_FUTURES}/openInterest?symbol=${symbol}`),
      fetch(`${BINANCE_FUTURES}/fundingRate?symbol=${symbol}&limit=1`),
    ]);
    const oi = await oiRes.json();
    const fr = await fundingRes.json();
    return {
      symbol,
      openInterest: Number(oi.openInterest ?? 0),
      fundingRate: Number(Array.isArray(fr) ? fr[0]?.fundingRate ?? 0 : fr.fundingRate ?? 0),
      takerBuyVolume: 0,
      takerSellVolume: 0,
    };
  } catch {
    return { symbol, openInterest: 0, fundingRate: 0, takerBuyVolume: 0, takerSellVolume: 0 };
  }
}

export async function fetchAllTokens(): Promise<TokenRow[]> {
  // Step 1: fetch ALL 24hr tickers in a single call (no symbols param)
  const tickerRes = await fetch(`${BINANCE_SPOT}/ticker/24hr`);
  if (!tickerRes.ok) throw new Error(`Binance ticker/24hr failed: ${tickerRes.status}`);
  const allTickers: Record<string, unknown>[] = await tickerRes.json();

  // Step 2: filter to USDT pairs and exclude stablecoins/leveraged tokens
  const filtered = allTickers.filter((t) => {
    const sym = String(t.symbol ?? "");
    if (!sym.endsWith("USDT")) return false;
    const base = sym.slice(0, -4);
    if (STABLECOINS.has(base)) return false;
    if (EXCLUDED_TOKENS.has(base)) return false;
    return true;
  });

  // Step 3: sort by quote volume descending, take top 100
  const top = filtered
    .sort((a, b) => Number(b.quoteVolume ?? 0) - Number(a.quoteVolume ?? 0))
    .slice(0, 100);

  const batchSize = 8;
  const rows: TokenRow[] = [];

  for (let i = 0; i < top.length; i += batchSize) {
    const batch = top.slice(i, i + batchSize);
    // small delay between batches to avoid rate limits
    if (i > 0) await new Promise((r) => setTimeout(r, 200));
    const batchResults = await Promise.allSettled(
      batch.map(async (t) => {
        const sym = String(t.symbol);
        const price = Number(t.lastPrice ?? 0);
        const volume24h = Number(t.quoteVolume ?? 0);
        const priceChange24h = Number(t.priceChangePercent ?? 0);
        const high24h = Number(t.highPrice ?? 0);
        const low24h = Number(t.lowPrice ?? 0);
        const tradeCount = Number(t.count ?? 0);

        const [klines, futures] = await Promise.allSettled([
          fetchOHLCV(sym),
          fetchFutures(sym),
        ]);
        const klinesData = klines.status === "fulfilled" ? klines.value : [];
        const futuresData = futures.status === "fulfilled" ? futures.value : null;

        const closes = klinesData.map((k) => k.close);

        const avgVolume =
          klinesData.length > 1
            ? klinesData
                .slice(0, -1)
                .reduce((s, k) => s + k.volume, 0) / Math.max(klinesData.length - 1, 1)
            : volume24h;

        const avgTrades = tradeCount;
        const prevVolume =
          klinesData.length >= 2 ? klinesData[klinesData.length - 2].volume : volume24h;

        const alpha = computeAlphaScore(volume24h, avgVolume, tradeCount, avgTrades, prevVolume, priceChange24h);
        const trend = computeTrendStrength(price, closes);
        const buyPressure = computeBuyPressure(
          futuresData?.takerBuyVolume ?? 0,
          volume24h
        );
        const hh = computeHigherHigh(price, closes.length >= 2 ? closes[closes.length - 2] : price);
        const fs = computeFundingStability(futuresData?.fundingRate ?? 0);

        const accumulation = computeAccumulationScore(
          avgVolume > 0 ? ((volume24h - avgVolume) / avgVolume) * 100 : 0,
          priceChange24h,
          (futuresData?.openInterest ?? 0) > 0,
          Math.abs(futuresData?.fundingRate ?? 0) < 0.01
        );

        const smartMoney = computeSmartMoneyScore(
          alpha,
          volume24h / Math.max(avgVolume, 1),
          buyPressure,
          tradeCount / Math.max(avgTrades, 1),
          accumulation
        );

        const swing = computeSwingScore(trend, volume24h / Math.max(avgVolume, 1), alpha * 0.5, hh, fs);

        const scores = { alpha, smartMoney, swing, accumulation, consensus: 0 };
        const consensus = computeConsensusScore(scores);
        scores.consensus = consensus;

        const tags = generateTags(scores, priceChange24h);

        return {
          symbol: sym,
          price,
          volume24h: volume24h,
          tradeCount,
          priceChange24h,
          high24h,
          low24h,
          ohlcv: klinesData,
          openInterest: futuresData?.openInterest ?? 0,
          fundingRate: futuresData?.fundingRate ?? 0,
          takerBuyVolume: futuresData?.takerBuyVolume ?? 0,
          takerSellVolume: futuresData?.takerSellVolume ?? 0,
          ...scores,
          tags,
        } as TokenRow;
      })
    );
    for (const result of batchResults) {
      if (result.status === "fulfilled") rows.push(result.value);
    }
  }

  return rows;
}
