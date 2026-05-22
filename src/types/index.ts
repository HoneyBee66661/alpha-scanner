export interface TokenSnapshot {
  symbol: string;
  price: number;
  volume24h: number;
  tradeCount: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  ohlcv: OHLCV[];
}

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FuturesData {
  symbol: string;
  openInterest: number;
  fundingRate: number;
  takerBuyVolume: number;
  takerSellVolume: number;
}

export interface Scores {
  alpha: number;
  smartMoney: number;
  swing: number;
  accumulation: number;
  consensus: number;
}

export interface TokenRow extends TokenSnapshot, FuturesData, Scores {
  tags: SignalTag[];
}

export type SignalTag =
  | "Smart Money"
  | "Accumulation"
  | "Breakout"
  | "Early Momentum"
  | "Trending"
  | "Overheated"
  | "High Risk";

export interface PaperTrade {
  id: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  timestamp: number;
  alphaSnapshot: number;
  smartMoneySnapshot: number;
  swingSnapshot: number;
  consensusSnapshot: number;
}

export interface Signal {
  id: string;
  symbol: string;
  timestamp: number;
  entryPrice: number;
  alphaScore: number;
  smartMoneyScore: number;
  swingScore: number;
  accumulationScore: number;
  consensusScore: number;
}

export interface UserSettings {
  buyFee: number;
  sellFee: number;
  taxRate: number;
  telegramBotToken: string;
  telegramChatId: string;
}

export type SortColumn =
  | "symbol"
  | "price"
  | "alpha"
  | "smartMoney"
  | "swing"
  | "accumulation"
  | "consensus"
  | "volume24h"
  | "priceChange24h";

export type SortDirection = "asc" | "desc";

export type ScannerView = "scanner" | "buy-recs" | "watchlist" | "smart-money" | "accumulation" | "portfolio" | "analytics" | "backtest" | "signal-log" | "settings";

export const STABLECOINS = new Set([
  "USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "USDD", "GUSD", "LUSD", "FRAX",
]);

export const EXCLUDED_TOKENS = new Set([
  "DOWN", "UP", "BEAR", "BULL", "ETHBULL", "ETHBEAR",
]);
