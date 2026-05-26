import type { TokenRow, PaperTrade, UserSettings, Scores } from "../types";
import { getBuyRecommendation } from "./buyRecommendation";
import { getSellRecommendation } from "./sellRecommendation";
import type { SellRecommendation } from "./sellRecommendation";

export interface AutoBuyAction {
  symbol: string;
  price: number;
  reason: string;
  score: number;
}

export interface AutoSellAction {
  trade: PaperTrade;
  recommendation: SellRecommendation;
  currentPrice: number;
}

export interface AutoTraderResult {
  buys: AutoBuyAction[];
  sells: AutoSellAction[];
}

export function runAutoTrader(
  tokens: TokenRow[],
  trades: PaperTrade[],
  priceMap: Map<string, number>,
  scoreMap: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>,
  settings: UserSettings
): AutoTraderResult {
  if (!settings.autoTradeEnabled) return { buys: [], sells: [] };

  const buys = evaluateAutoBuys(tokens, trades, settings);
  const sells = evaluateAutoSells(trades, priceMap, scoreMap);

  return { buys, sells };
}

function evaluateAutoBuys(
  tokens: TokenRow[],
  trades: PaperTrade[],
  settings: UserSettings
): AutoBuyAction[] {
  const heldSymbols = new Set(trades.map((t) => t.symbol));
  const availableSlots = settings.autoTradeMaxPositions - trades.length;
  if (availableSlots <= 0) return [];

  const candidates: AutoBuyAction[] = [];

  for (const token of tokens) {
    if (heldSymbols.has(token.symbol)) continue;

    const rec = getBuyRecommendation(token);
    if (rec.action !== "STRONG_BUY" || rec.urgency !== "high") continue;

    candidates.push({
      symbol: token.symbol,
      price: token.price,
      reason: rec.reason,
      score: rec.score,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, availableSlots);
}

function evaluateAutoSells(
  trades: PaperTrade[],
  priceMap: Map<string, number>,
  scoreMap: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>
): AutoSellAction[] {
  const actions: AutoSellAction[] = [];

  for (const trade of trades) {
    const currentPrice = priceMap.get(trade.symbol) ?? trade.entryPrice;
    const currentScores = scoreMap.get(trade.symbol);

    const rec: SellRecommendation = currentScores
      ? getSellRecommendation(trade, currentPrice, currentScores as Scores)
      : getSellRecommendation(trade, currentPrice);

    if (rec.action === "HOLD") continue;

    // Auto-sell on critical/high urgency, or medium urgency for TP/SL/trend reversal
    const shouldSell =
      rec.urgency === "critical" ||
      rec.urgency === "high" ||
      (rec.urgency === "medium" && (
        rec.action === "TAKE_PROFIT" ||
        rec.action === "STOP_LOSS" ||
        rec.action === "TREND_REVERSAL"
      ));

    if (shouldSell) {
      actions.push({ trade, recommendation: rec, currentPrice });
    }
  }

  return actions;
}
