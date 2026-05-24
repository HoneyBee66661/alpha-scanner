import type {
  TokenSnapshot,
  FuturesData,
  TokenRow,
  OHLCV,
} from "../types";
import { STABLECOINS, EXCLUDED_TOKENS } from "../types";
import {
  computeMomentumScore,
  computeSmartMoneyScore,
  computeStructureScore,
  computeAccumulationScore,
  computeSentimentScore,
  computeMMFootprint,
  computeConsensusScore,
  computeOHLCVMetrics,
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

        const metrics = computeOHLCVMetrics(klinesData);
        const oiCurrent = futuresData?.openInterest ?? 0;
        // Approximate OI delta — use volume ratio as proxy when no historical OI data
        const oiDelta24h = oiCurrent > 0 ? ((volume24h / Math.max(metrics.avgVol, 1)) - 1) * 5 : 0;
        const buyRatio = (futuresData?.takerBuyVolume ?? 0) > 0
          ? (futuresData?.takerBuyVolume ?? 0) / Math.max((futuresData?.takerBuyVolume ?? 0) + (futuresData?.takerSellVolume ?? 0), 1)
          : 0.5;
        const rvol = metrics.avgVol > 0 ? metrics.recentVol / metrics.avgVol : 1;

        const momentum = computeMomentumScore(metrics, priceChange24h);
        const smartMoney = computeSmartMoneyScore(
          oiDelta24h, priceChange24h,
          futuresData?.fundingRate ?? 0, futuresData?.fundingRate ?? 0, // no history available, use current
          buyRatio, rvol
        );
        const structure = computeStructureScore(metrics, priceChange24h);
        const accumulation = computeAccumulationScore(metrics, oiDelta24h, futuresData?.fundingRate ?? 0);
        const sentiment = computeSentimentScore(
          futuresData?.fundingRate ?? 0, oiDelta24h, priceChange24h, buyRatio
        );
        const mmFootprint = computeMMFootprint(metrics, price);

        const scores = { momentum, smartMoney, structure, accumulation, sentiment, mmFootprint, consensus: 0 };
        const consensus = computeConsensusScore(scores);
        scores.consensus = consensus;

        const tags = generateTags(scores, priceChange24h);

        return {
          symbol: sym,
          price,
          volume24h,
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
