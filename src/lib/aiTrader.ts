import type { TokenRow, PaperTrade } from "../types";
import type { AutoBuyAction, AutoSellAction } from "./autoTrader";
import { getSellRecommendation } from "./sellRecommendation";
import type { SellRecommendation } from "./sellRecommendation";
import type { Scores } from "../types";

export interface AITraderConfig {
  deepseekApiKey: string;
}

interface AIDecision {
  buys: { symbol: string; confidence: number; reasoning: string }[];
  sells: { symbol: string; reasoning: string }[];
}

const AI_BUY_MAX = 3;

function buildPrompt(
  tokens: TokenRow[],
  trades: PaperTrade[],
  balance: number,
  budgetPerTrade: number,
  maxPositions: number
): string {
  const topTokens = tokens.slice(0, 30);

  const tokenLines = topTokens.map((t) =>
    `${t.symbol} | $${t.price.toFixed(4)} | 24h:${t.priceChange24h.toFixed(1)}% | Vol:$${(t.volume24h / 1e6).toFixed(1)}M | ` +
    `M:${t.momentum} SM:${t.smartMoney} St:${t.structure} Ac:${t.accumulation} Se:${t.sentiment} MM:${t.mmFootprint} | C:${t.consensus} | ` +
    `Tags:${t.tags.join(",") || "none"}`
  ).join("\n");

  const openSlots = maxPositions - trades.length;

  let positionsBlock = "No open positions.";
  if (trades.length > 0) {
    const lines = trades.map((t) =>
      `${t.symbol} | Entry:$${t.entryPrice.toFixed(4)} | Qty:${t.quantity.toFixed(4)} | ` +
      `Entry scores: M:${t.momentumSnapshot} SM:${t.smartMoneySnapshot} St:${t.structureSnapshot} Ac:${t.accumulationSnapshot} C:${t.consensusSnapshot}`
    );
    positionsBlock = lines.join("\n");
  }

  return `You are an autonomous crypto paper-trader analyzing Binance USDT perpetual pairs. Your goal: maximize risk-adjusted returns over a multi-day horizon.

## Market data (top 30 by consensus score)
Symbol | Price | 24h% | Vol | M(omentum) SM(art$) St(ructure) Ac(cumulation) Se(ntiment) MM(Footprint) | C(onsensus) | Tags

${tokenLines}

## Your open positions
${positionsBlock}

## Constraints
- Paper balance: $${balance.toFixed(2)}
- Budget per trade: $${budgetPerTrade.toFixed(2)}
- Max positions: ${maxPositions}
- Open slots: ${openSlots}
- Max new buys this round: ${AI_BUY_MAX}

## Scoring guide
- Momentum (M): trend strength + volume acceleration (0-100)
- Smart Money (SM): OI/price alignment + funding rate + buy/sell imbalance (0-100)
- Structure (St): support/resistance + market phase + breakout quality (0-100)
- Accumulation (Ac): volume dry-up + compression + Wyckoff springs (0-100)
- Sentiment (Se): funding sentiment + OI-price sentiment + buy dominance (0-100)
- MM Footprint (MM): round numbers + absorption + liquidity patterns (0-100)
- Consensus (C): weighted composite — 25% M, 25% SM, 20% St, 15% Ac, 10% Se, 5% MM

## Trading rules
- Prefer entry on tokens with Consensus >= 70 AND Smart Money >= 65
- Avoid tokens that pumped >25% in 24h (likely overextended)
- Favor accumulation signals (compression + volume dry-up) for entries
- Sell when Consensus drops significantly from entry, or when trend reverses
- Diversify across uncorrelated narratives
- Do NOT buy stablecoins or leveraged tokens

Reply with ONLY valid JSON (no markdown, no code fences):
{
  "buys": [
    { "symbol": "BTCUSDT", "confidence": 85, "reasoning": "High consensus with smart money accumulation..." }
  ],
  "sells": [
    { "symbol": "ETHUSDT", "reasoning": "Consensus dropped 18pts from entry, trend turning..." }
  ]
}`;
}

export async function runAITrader(
  tokens: TokenRow[],
  trades: PaperTrade[],
  priceMap: Map<string, number>,
  scoreMap: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>,
  config: AITraderConfig,
  balance: number,
  budgetPerTrade: number,
  maxPositions: number
): Promise<{ buys: AutoBuyAction[]; sells: AutoSellAction[]; error?: string; analysis?: string }> {
  if (!config.deepseekApiKey) {
    return { buys: [], sells: [], error: "DeepSeek API key not configured" };
  }

  if (balance < budgetPerTrade && trades.length === 0) {
    return { buys: [], sells: [] };
  }

  const heldSymbols = new Set(trades.map((t) => t.symbol));
  const sorted = [...tokens].sort((a, b) => b.consensus - a.consensus);

  // Evaluate rule-based sells for the AI to consider
  const sellCandidates: AutoSellAction[] = [];
  for (const trade of trades) {
    const currentPrice = priceMap.get(trade.symbol) ?? trade.entryPrice;
    const currentScores = scoreMap.get(trade.symbol);
    const rec: SellRecommendation = currentScores
      ? getSellRecommendation(trade, currentPrice, currentScores as Scores)
      : getSellRecommendation(trade, currentPrice);
    if (rec.action !== "HOLD") {
      sellCandidates.push({ trade, recommendation: rec, currentPrice });
    }
  }

  const prompt = buildPrompt(sorted, trades, balance, budgetPerTrade, maxPositions);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.deepseekApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { buys: [], sells: [], error: `DeepSeek API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return { buys: [], sells: [], error: "DeepSeek returned empty response" };
    }

    // Handle both raw JSON and code-fenced JSON
    const jsonStr = text.startsWith("```") ? text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "") : text;

    let decision: AIDecision;
    try {
      decision = JSON.parse(jsonStr) as AIDecision;
    } catch {
      return { buys: [], sells: [], error: `AI response parse error: ${text.slice(0, 200)}` };
    }

    // Validate and filter buy decisions
    const buys: AutoBuyAction[] = [];
    const seenSymbols = new Set(heldSymbols);

    for (const b of (decision.buys ?? []).slice(0, AI_BUY_MAX)) {
      const token = tokens.find((t) => t.symbol === b.symbol);
      if (!token) continue;
      if (seenSymbols.has(b.symbol)) continue;
      if (balance - (buys.length + 1) * budgetPerTrade < 0) break;

      buys.push({
        symbol: b.symbol,
        price: token.price,
        reason: `[AI] ${b.reasoning.slice(0, 120)}`,
        score: b.confidence ?? 50,
      });
      seenSymbols.add(b.symbol);
    }

    // AI sells: cross-reference AI sell decisions with rule-based sell candidates
    const sells: AutoSellAction[] = [];
    const aiSellSymbols = new Set((decision.sells ?? []).map((s) => s.symbol));

    for (const sc of sellCandidates) {
      if (aiSellSymbols.has(sc.trade.symbol)) {
        sells.push(sc);
      }
    }

    return { buys, sells };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { buys: [], sells: [], error: "AI request timed out (25s)" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { buys: [], sells: [], error: message };
  }
}
