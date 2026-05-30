import type { TokenRow, OHLCV } from '../types/index.js';
import { STABLECOINS, EXCLUDED_TOKENS } from '../types/index.js';
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
} from './scores.js';

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

function sparklineToOHLCV(prices: number[], dailyVolume: number): OHLCV[] {
  if (prices.length < 2) {
    const p = prices[0] ?? 0;
    return [{ open: p, high: p, low: p, close: p, volume: dailyVolume }];
  }
  const candles: OHLCV[] = [];
  const volPerCandle = dailyVolume / Math.max(prices.length - 1, 1);
  for (let i = 0; i < prices.length - 1; i++) {
    const open = prices[i];
    const close = prices[i + 1];
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    candles.push({ open, high, low, close, volume: volPerCandle });
  }
  return candles.slice(-50);
}

export async function fetchCoinGeckoTokens(): Promise<TokenRow[]> {
  // Fetch top 100 by volume across 2 pages (CoinGecko caps at 250 per page but 100 is safer)
  const [page1, page2] = await Promise.all([
    fetch(
      `${CG_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`
    ),
    fetch(
      `${CG_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=2&sparkline=true&price_change_percentage=24h`
    ),
  ]);

  const data1: CGMarket[] = page1.ok ? await page1.json() : [];
  const data2: CGMarket[] = page2.ok ? await page2.json() : [];
  const data = [...data1, ...data2];

  if (!data.length) throw new Error("CoinGecko API failed");

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
      const distVolume = volume24h / 24;
      const ohlcv = c.sparkline_in_7d?.price
        ? sparklineToOHLCV(c.sparkline_in_7d.price, distVolume)
        : [
            { open: price, high: high24h, low: low24h, close: price, volume: distVolume },
          ];

      const metrics = computeOHLCVMetrics(ohlcv);
      const tradeCount = Math.floor(volume24h / Math.max(price, 0.0001) / 5);
      // CoinGecko estimates (no real perps data)
      const oiEstimate = c.market_cap * 0.02;
      const oiDelta24h = priceChange24h * 0.8; // OI tends to follow price
      const buyRatio = 0.52; // slight buy bias as market estimate
      const rvol = metrics.avgVol > 0 ? metrics.recentVol / metrics.avgVol : 1;

      const momentum = computeMomentumScore(metrics, priceChange24h);
      const smartMoney = computeSmartMoneyScore(oiDelta24h, priceChange24h, 0, 0, buyRatio, rvol);
      const structure = computeStructureScore(metrics, priceChange24h);
      const accumulation = computeAccumulationScore(metrics, oiDelta24h, 0);
      const sentiment = computeSentimentScore(0, oiDelta24h, priceChange24h, buyRatio);
      const mmFootprint = computeMMFootprint(metrics, price);

      const scores = { momentum, smartMoney, structure, accumulation, sentiment, mmFootprint, consensus: 0 };
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
        openInterest: oiEstimate,
        fundingRate: 0,
        takerBuyVolume: volume24h * 0.55,
        takerSellVolume: volume24h * 0.45,
        ...scores,
        tags: generateTags(scores, priceChange24h),
      } as TokenRow;
    });

  return rows;
}
