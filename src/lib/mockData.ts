import type { TokenRow, OHLCV, SignalTag } from "../types";

const TOP_TOKENS: { base: string; price: number; volScale: number; trend: number }[] = [
  { base: "BTC", price: 87650.32, volScale: 1.0, trend: 0.6 },
  { base: "ETH", price: 4020.18, volScale: 0.85, trend: 0.55 },
  { base: "BNB", price: 620.45, volScale: 0.5, trend: 0.4 },
  { base: "SOL", price: 172.33, volScale: 0.7, trend: 0.65 },
  { base: "XRP", price: 2.34, volScale: 0.55, trend: 0.7 },
  { base: "DOGE", price: 0.321, volScale: 0.45, trend: 0.35 },
  { base: "ADA", price: 0.98, volScale: 0.4, trend: 0.5 },
  { base: "AVAX", price: 38.52, volScale: 0.35, trend: 0.45 },
  { base: "DOT", price: 12.77, volScale: 0.3, trend: 0.3 },
  { base: "MATIC", price: 0.87, volScale: 0.3, trend: 0.25 },
  { base: "LINK", price: 22.41, volScale: 0.4, trend: 0.6 },
  { base: "UNI", price: 15.23, volScale: 0.25, trend: 0.55 },
  { base: "ATOM", price: 8.91, volScale: 0.2, trend: 0.3 },
  { base: "APT", price: 12.04, volScale: 0.25, trend: 0.5 },
  { base: "ARB", price: 0.76, volScale: 0.35, trend: 0.4 },
  { base: "OP", price: 2.98, volScale: 0.25, trend: 0.45 },
  { base: "NEAR", price: 6.12, volScale: 0.3, trend: 0.55 },
  { base: "INJ", price: 28.45, volScale: 0.2, trend: 0.65 },
  { base: "RUNE", price: 5.33, volScale: 0.15, trend: 0.5 },
  { base: "SEI", price: 0.34, volScale: 0.3, trend: 0.6 },
  { base: "TIA", price: 7.82, volScale: 0.25, trend: 0.35 },
  { base: "SUI", price: 1.89, volScale: 0.4, trend: 0.7 },
  { base: "PEPE", price: 0.0000123, volScale: 0.35, trend: 0.5 },
  { base: "WIF", price: 2.14, volScale: 0.25, trend: 0.45 },
  { base: "BONK", price: 0.0000284, volScale: 0.2, trend: 0.4 },
  { base: "RNDR", price: 11.23, volScale: 0.25, trend: 0.6 },
  { base: "FET", price: 2.15, volScale: 0.3, trend: 0.55 },
  { base: "AGIX", price: 0.89, volScale: 0.2, trend: 0.5 },
  { base: "OCEAN", price: 1.12, volScale: 0.15, trend: 0.45 },
  { base: "LDO", price: 2.67, volScale: 0.2, trend: 0.4 },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateOHLCV(
  basePrice: number,
  count: number,
  trend: number,
  rand: () => number
): OHLCV[] {
  const candles: OHLCV[] = [];
  let price = basePrice * (1 - (count * 0.002) * trend + (rand() - 0.5) * 0.02);
  for (let i = 0; i < count; i++) {
    const vol = basePrice * (0.5 + rand() * 2) * 100;
    const change = (rand() - 0.48) * 0.015 + trend * 0.003;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + rand() * 0.008);
    const low = Math.min(open, close) * (1 - rand() * 0.008);
    candles.push({ open, high, low, close, volume: vol });
    price = close;
  }
  return candles;
}

const tagOptions: SignalTag[][] = [
  ["Smart Money", "Breakout"],
  ["Accumulation", "Trending"],
  ["Early Momentum"],
  ["Smart Money", "Accumulation", "Breakout"],
  ["Trending"],
  ["Breakout"],
  ["Early Momentum", "Trending"],
  ["Overheated", "High Risk"],
  ["Smart Money"],
  ["Accumulation"],
];

export function generateMockTokens(): TokenRow[] {
  const rand = seededRandom(Date.now());
  const now = Date.now();

  return TOP_TOKENS.map((t, i) => {
    const price = t.price * (1 + (rand() - 0.5) * 0.04);
    const ohlcv = generateOHLCV(price, 50, t.trend, rand);
    const closes = ohlcv.map((c) => c.close);
    const volume24h = 500_000_000 * t.volScale * (0.5 + rand());
    const avgVolume = volume24h * (0.3 + rand() * 0.5);
    const priceChange24h = (rand() - 0.45) * 12 * (0.5 + t.trend);
    const tradeCount = Math.floor(50_000 * t.volScale * (0.5 + rand()));

    const alpha = Math.round(
      Math.min(100, Math.max(0, 35 + rand() * 50 + t.trend * 20 + priceChange24h * 2))
    );
    const smartMoney = Math.round(
      Math.min(100, Math.max(0, 30 + rand() * 55 + t.trend * 20 - Math.abs(priceChange24h)))
    );
    const swing = Math.round(
      Math.min(100, Math.max(0, 25 + rand() * 55 + t.trend * 25))
    );
    const accumulation = Math.round(
      Math.min(100, Math.max(0, 20 + rand() * 60 + t.trend * 15))
    );
    const consensus = Math.round(
      smartMoney * 0.35 + swing * 0.25 + alpha * 0.2 + accumulation * 0.2
    );

    const tags: SignalTag[] = [];
    if (smartMoney >= 75) tags.push("Smart Money");
    if (accumulation >= 70) tags.push("Accumulation");
    if (alpha >= 80) tags.push("Breakout");
    if (alpha >= 65 && smartMoney < 75 && accumulation < 70) tags.push("Early Momentum");
    if (swing >= 70) tags.push("Trending");
    if (alpha >= 95) tags.push("Overheated");
    if (priceChange24h > 40 || consensus < 30) tags.push("High Risk");
    if (tags.length === 0) tags.push(tagOptions[i % tagOptions.length][0]);

    return {
      symbol: `${t.base}USDT`,
      price,
      volume24h,
      tradeCount,
      priceChange24h,
      high24h: price * (1 + Math.abs(priceChange24h / 100) * 1.2),
      low24h: price * (1 - Math.abs(priceChange24h / 100) * 1.1),
      ohlcv,
      openInterest: 200_000_000 * t.volScale * (0.5 + rand()),
      fundingRate: (rand() - 0.5) * 0.002,
      takerBuyVolume: volume24h * (0.4 + rand() * 0.2),
      takerSellVolume: volume24h * (0.4 + rand() * 0.2),
      alpha,
      smartMoney,
      swing,
      accumulation,
      consensus,
      tags,
    };
  });
}
