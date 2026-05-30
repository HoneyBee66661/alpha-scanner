import type { TokenRow, OHLCV, SignalTag } from '../types/index.js';

function clampM(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function generateMockTags(scores: { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }, priceChange24h: number, _i: number): SignalTag[] {
  const tags: SignalTag[] = [];
  if (scores.smartMoney >= 70) tags.push("Smart Money");
  if (scores.accumulation >= 65) tags.push("Accumulation");
  if (scores.momentum >= 75) tags.push("Breakout");
  if (scores.momentum >= 60 && scores.smartMoney < 70 && scores.accumulation < 65) tags.push("Early Momentum");
  if (scores.structure >= 65) tags.push("Trending");
  if (scores.momentum >= 90 || priceChange24h > 30) tags.push("Overheated");
  if (priceChange24h > 40 || scores.consensus < 25) tags.push("High Risk");
  if (tags.length === 0) tags.push("Early Momentum");
  return tags;
}

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
  { base: "AAVE", price: 145.32, volScale: 0.3, trend: 0.55 },
  { base: "FTM", price: 1.14, volScale: 0.25, trend: 0.5 },
  { base: "GRT", price: 0.31, volScale: 0.2, trend: 0.4 },
  { base: "ALGO", price: 0.28, volScale: 0.2, trend: 0.35 },
  { base: "SAND", price: 0.56, volScale: 0.2, trend: 0.3 },
  { base: "AXS", price: 9.87, volScale: 0.2, trend: 0.45 },
  { base: "THETA", price: 2.34, volScale: 0.2, trend: 0.5 },
  { base: "FIL", price: 7.23, volScale: 0.25, trend: 0.4 },
  { base: "ICP", price: 14.56, volScale: 0.25, trend: 0.55 },
  { base: "VET", price: 0.045, volScale: 0.2, trend: 0.35 },
  { base: "EGLD", price: 45.67, volScale: 0.15, trend: 0.4 },
  { base: "MANA", price: 0.49, volScale: 0.2, trend: 0.35 },
  { base: "EOS", price: 1.23, volScale: 0.2, trend: 0.3 },
  { base: "FLOW", price: 0.78, volScale: 0.2, trend: 0.45 },
  { base: "XTZ", price: 1.56, volScale: 0.15, trend: 0.35 },
  { base: "CRV", price: 0.67, volScale: 0.2, trend: 0.4 },
  { base: "GALA", price: 0.042, volScale: 0.25, trend: 0.45 },
  { base: "KLAY", price: 0.23, volScale: 0.15, trend: 0.3 },
  { base: "CHZ", price: 0.12, volScale: 0.2, trend: 0.4 },
  { base: "SNX", price: 3.45, volScale: 0.15, trend: 0.35 },
  { base: "COMP", price: 78.34, volScale: 0.15, trend: 0.4 },
  { base: "MKR", price: 2450.12, volScale: 0.25, trend: 0.5 },
  { base: "ZIL", price: 0.034, volScale: 0.15, trend: 0.3 },
  { base: "ENJ", price: 0.38, volScale: 0.15, trend: 0.35 },
  { base: "BAT", price: 0.28, volScale: 0.1, trend: 0.3 },
  { base: "LRC", price: 0.31, volScale: 0.15, trend: 0.35 },
  { base: "HBAR", price: 0.12, volScale: 0.3, trend: 0.55 },
  { base: "STX", price: 2.45, volScale: 0.25, trend: 0.5 },
  { base: "IMX", price: 1.89, volScale: 0.25, trend: 0.5 },
  { base: "MINA", price: 0.78, volScale: 0.2, trend: 0.45 },
  { base: "KAVA", price: 0.92, volScale: 0.15, trend: 0.4 },
  { base: "FLR", price: 0.034, volScale: 0.15, trend: 0.35 },
  { base: "CFX", price: 0.21, volScale: 0.2, trend: 0.45 },
  { base: "MASK", price: 4.56, volScale: 0.15, trend: 0.5 },
  { base: "DYDX", price: 2.78, volScale: 0.2, trend: 0.45 },
  { base: "ILV", price: 89.34, volScale: 0.1, trend: 0.4 },
  { base: "GMT", price: 0.28, volScale: 0.2, trend: 0.35 },
  { base: "ENS", price: 18.92, volScale: 0.2, trend: 0.5 },
  { base: "GLM", price: 0.45, volScale: 0.15, trend: 0.4 },
  { base: "ROSE", price: 0.09, volScale: 0.15, trend: 0.45 },
  { base: "ONE", price: 0.023, volScale: 0.15, trend: 0.3 },
  { base: "CELO", price: 0.78, volScale: 0.1, trend: 0.35 },
  { base: "ANKR", price: 0.041, volScale: 0.15, trend: 0.4 },
  { base: "SKL", price: 0.067, volScale: 0.1, trend: 0.35 },
  { base: "LPT", price: 14.23, volScale: 0.15, trend: 0.45 },
  { base: "BAND", price: 2.12, volScale: 0.1, trend: 0.35 },
  { base: "STORJ", price: 0.56, volScale: 0.15, trend: 0.4 },
  { base: "ZRX", price: 0.45, volScale: 0.15, trend: 0.35 },
  { base: "KNC", price: 0.89, volScale: 0.1, trend: 0.3 },
  { base: "SFP", price: 0.78, volScale: 0.1, trend: 0.35 },
  { base: "TRX", price: 0.23, volScale: 0.45, trend: 0.5 },
  { base: "SHIB", price: 0.0000234, volScale: 0.35, trend: 0.4 },
  { base: "TON", price: 6.78, volScale: 0.35, trend: 0.55 },
  { base: "ORDI", price: 38.92, volScale: 0.25, trend: 0.45 },
  { base: "1000SATS", price: 0.00021, volScale: 0.2, trend: 0.4 },
  { base: "JUP", price: 1.12, volScale: 0.3, trend: 0.55 },
  { base: "PYTH", price: 0.41, volScale: 0.25, trend: 0.45 },
  { base: "JTO", price: 3.45, volScale: 0.25, trend: 0.5 },
  { base: "STRK", price: 0.56, volScale: 0.2, trend: 0.35 },
  { base: "WLD", price: 3.21, volScale: 0.3, trend: 0.55 },
  { base: "MEME", price: 0.019, volScale: 0.15, trend: 0.4 },
  { base: "ACE", price: 3.89, volScale: 0.15, trend: 0.4 },
  { base: "NFP", price: 0.34, volScale: 0.15, trend: 0.35 },
  { base: "AI", price: 1.23, volScale: 0.2, trend: 0.55 },
  { base: "XAI", price: 0.56, volScale: 0.2, trend: 0.45 },
  { base: "PIXEL", price: 0.18, volScale: 0.2, trend: 0.4 },
  { base: "PORTAL", price: 0.45, volScale: 0.15, trend: 0.35 },
  { base: "AEVO", price: 0.67, volScale: 0.2, trend: 0.4 },
  { base: "ETHFI", price: 3.45, volScale: 0.2, trend: 0.45 },
  { base: "ENA", price: 1.23, volScale: 0.3, trend: 0.55 },
  { base: "SAGA", price: 2.34, volScale: 0.2, trend: 0.45 },
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

export function generateMockTokens(): TokenRow[] {
  const rand = seededRandom(Date.now());

  return TOP_TOKENS.map((t, i) => {
    const price = t.price * (1 + (rand() - 0.5) * 0.04);
    const ohlcv = generateOHLCV(price, 50, t.trend, rand);
    const volume24h = 500_000_000 * t.volScale * (0.5 + rand());
    const priceChange24h = (rand() - 0.45) * 12 * (0.5 + t.trend);
    const tradeCount = Math.floor(50_000 * t.volScale * (0.5 + rand()));

    // Realistic mock scores with differentiated distributions
    const baseNoise = () => rand() * 40 - 20; // -20 to +20
    const momentum = clampM(35 + t.trend * 25 + priceChange24h * 1.5 + baseNoise());
    const smartMoney = clampM(30 + t.trend * 20 + t.volScale * 20 + baseNoise());
    const structure = clampM(30 + t.trend * 25 + baseNoise());
    const accumulation = clampM(25 + t.trend * 20 + baseNoise());
    const sentiment = clampM(40 + priceChange24h * 0.5 + baseNoise());
    const mmFootprint = clampM(30 + t.volScale * 15 + baseNoise() * 0.7);
    const consensus = clampM(Math.round(
      momentum * 0.25 + smartMoney * 0.25 + structure * 0.20 +
      accumulation * 0.15 + sentiment * 0.10 + mmFootprint * 0.05
    ));

    const scores = { momentum, smartMoney, structure, accumulation, sentiment, mmFootprint, consensus };
    const tags = generateMockTags(scores, priceChange24h, i);

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
      ...scores,
      tags,
    };
  });
}
