import type { TokenRow, OHLCV } from "../types";
import { STABLECOINS, EXCLUDED_TOKENS } from "../types";
import {
  computeAlphaScore,
  computeSmartMoneyScore,
  computeSwingScore,
  computeAccumulationScore,
  computeConsensusScore,
  computeTrendStrength,
  computeBuyPressure,
  computeHigherHigh,
  computeFundingStability,
  generateTags,
} from "./scores";

const CG_BASE = "https://api.coingecko.com/api/v3";

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  market_cap: number;
  sparkline_in_7d?: { price: number[] };
}

function sparklineToOHLCV(prices: number[]): OHLCV[] {
  if (prices.length < 2) {
    const p = prices[0] ?? 0;
    return [{ open: p, high: p, low: p, close: p, volume: 0 }];
  }
  const candles: OHLCV[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    const open = prices[i];
    const close = prices[i + 1];
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    candles.push({ open, high, low, close, volume: 0 });
  }
  return candles.slice(-50);
}

export async function fetchCoinGeckoTokens(): Promise<TokenRow[]> {
  const res = await fetch(
    `${CG_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h`
  );
  if (!res.ok) {
    throw new Error(`CoinGecko API failed: ${res.status}`);
  }

  const data: CGMarket[] = await res.json();

  const rows: TokenRow[] = data
    .filter((c) => {
      const sym = c.symbol.toUpperCase();
      if (STABLECOINS.has(sym)) return false;
      if (EXCLUDED_TOKENS.has(sym)) return false;
      return true;
    })
    .map((c) => {
      const sym = c.symbol.toUpperCase() + "USDT";
      const price = c.current_price ?? 0;
      const volume24h = c.total_volume ?? 0;
      const priceChange24h = c.price_change_percentage_24h ?? 0;
      const high24h = c.high_24h ?? price;
      const low24h = c.low_24h ?? price;
      const ohlcv = c.sparkline_in_7d?.price
        ? sparklineToOHLCV(c.sparkline_in_7d.price)
        : [
            { open: price, high: high24h, low: low24h, close: price, volume: volume24h },
          ];

      const closes = ohlcv.map((k) => k.close);
      const avgVolume = ohlcv.length > 1
        ? ohlcv.slice(0, -1).reduce((s, k) => s + (k.volume || volume24h / ohlcv.length), 0) /
          Math.max(ohlcv.length - 1, 1)
        : volume24h;
      const tradeCount = Math.floor(volume24h / price / 10);
      const prevVolume = ohlcv.length >= 2 ? ohlcv[ohlcv.length - 2].volume || avgVolume : avgVolume;

      const alpha = computeAlphaScore(volume24h, avgVolume, tradeCount, tradeCount, prevVolume, priceChange24h);
      const trend = computeTrendStrength(price, closes);
      const buyPressure = computeBuyPressure(0, volume24h);
      const hh = computeHigherHigh(price, closes.length >= 2 ? closes[closes.length - 2] : price);
      const fs = computeFundingStability(0);

      const accumulation = computeAccumulationScore(
        avgVolume > 0 ? ((volume24h - avgVolume) / avgVolume) * 100 : 0,
        priceChange24h,
        false,
        true
      );

      const smartMoney = computeSmartMoneyScore(alpha, volume24h / Math.max(avgVolume, 1), buyPressure, 1, accumulation);
      const swing = computeSwingScore(trend, volume24h / Math.max(avgVolume, 1), alpha * 0.5, hh, fs);
      const scores = { alpha, smartMoney, swing, accumulation, consensus: 0 };
      const consensus = computeConsensusScore(scores);
      scores.consensus = consensus;

      return {
        symbol: sym,
        price,
        volume24h,
        tradeCount,
        priceChange24h,
        high24h,
        low24h,
        ohlcv,
        openInterest: c.market_cap * 0.02,
        fundingRate: 0,
        takerBuyVolume: 0,
        takerSellVolume: 0,
        ...scores,
        tags: generateTags(scores, priceChange24h),
      } as TokenRow;
    });

  return rows;
}
