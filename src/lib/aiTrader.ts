import type { TokenRow, PaperTrade } from '../types/index.js';
import type { AutoBuyAction, AutoSellAction } from './autoTrader.js';
import { getSellRecommendation } from './sellRecommendation.js';
import type { SellRecommendation, SellAction, Urgency } from './sellRecommendation.js';
import type { Scores } from '../types/index.js';
import { STABLECOINS, EXCLUDED_TOKENS } from '../types/index.js';
import { computeOHLCVMetrics } from './scores.js';
import type { OHLCVMetrics } from './scores.js';

export interface AITraderConfig {
  deepseekApiKey: string;
}

interface AIDecision {
  buys: { symbol: string; confidence: number; reasoning: string }[];
  sells: { symbol: string; reasoning: string }[];
}

const AI_BUY_MAX = 3;

function parseAIDecision(text: string): AIDecision | null {
  const jsonStr = text.startsWith("```")
    ? text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "")
    : text;
  try {
    return JSON.parse(jsonStr) as AIDecision;
  } catch {
    // Try to extract JSON object from text using regex
    const match = jsonStr.match(/\{[\s\S]*"buys"[\s\S]*"sells"[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as AIDecision; } catch { /* fall through */ }
    }
    return null;
  }
}

function buildPrompt(
  tokens: TokenRow[],
  trades: PaperTrade[],
  balance: number,
  budgetPerTrade: number,
  maxPositions: number
): string {
  const topTokens = tokens.slice(0, 60);

  const tokenLines = topTokens.map((t) => {
    let phase = "~", volTrend = "~", rvol = "";
    if (t.ohlcv && t.ohlcv.length >= 14) {
      try {
        const m = computeOHLCVMetrics(t.ohlcv);
        volTrend = m.volTrend > 0.05 ? "V+" : m.volTrend < -0.05 ? "V-" : "V~";
        phase = m.higherHighs >= 3 && m.rangeCompression > 1.1 ? "trend" :
                m.rangeCompression < 0.8 ? "sqz" : "~";
        rvol = m.avgVol > 0 ? `rv:${(m.recentVol / m.avgVol).toFixed(1)}x` : "";
      } catch { /* skip metrics on error */ }
    }
    return `${t.symbol} | $${t.price.toFixed(4)} | 24h:${t.priceChange24h.toFixed(1)}% | Vol:$${(t.volume24h / 1e6).toFixed(1)}M | ` +
      `M:${t.momentum} SM:${t.smartMoney} St:${t.structure} Ac:${t.accumulation} Se:${t.sentiment} MM:${t.mmFootprint} | C:${t.consensus} | ` +
      `${phase} ${volTrend} ${rvol} | ` +
      `Tags:${t.tags.join(",") || "none"}`;
  }).join("\n");

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

## Market data (top 60 tokens)
Symbol | Price | 24h% | Vol | M(omentum) SM(art$) St(ructure) Ac(cumulation) Se(ntiment) MM(Footprint) | C(onsensus) | Phase VTrend RVol | Tags

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
- Phase: market structure (trend/squeeze/~)
- VTrend: volume direction (V+/V-/V~)
- RVol: recent volume / average volume (x factor)

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
  maxPositions: number,
  startedAt: number
): Promise<{ buys: AutoBuyAction[]; sells: AutoSellAction[]; error?: string; analysis?: string }> {
  if (!config.deepseekApiKey) {
    return { buys: [], sells: [], error: "DeepSeek API key not configured" };
  }

  if (balance < budgetPerTrade && trades.length === 0) {
    return { buys: [], sells: [] };
  }

  const heldSymbols = new Set(trades.map((t) => t.symbol));

  // Filter out stablecoins and excluded tokens
  const filteredTokens = tokens.filter((t) => {
    const base = t.symbol.replace("USDT", "");
    return !STABLECOINS.has(base) && !EXCLUDED_TOKENS.has(base);
  });

  // Time-seeded shuffle to break LLM anchoring bias while staying deterministic per minute
  const seed = Math.floor(Date.now() / 60000);
  const shuffled = [...filteredTokens]
    .map((t, i) => ({ t, sortKey: ((t.consensus * 9301 + i * 49297 + seed * 233) % 100000) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ t }) => t);

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

  const prompt = buildPrompt(shuffled, trades, balance, budgetPerTrade, maxPositions);

  const controller = new AbortController();
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(5000, 8000 - elapsed);
  const timeout = setTimeout(() => controller.abort(), remaining);

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
      return { buys: [], sells: sellCandidates, error: `DeepSeek API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return { buys: [], sells: sellCandidates, error: "DeepSeek returned empty response" };
    }

    // Parse JSON with retry on failure
    let decision = parseAIDecision(text);
    if (!decision) {
      // One retry with stricter instruction + lower temperature
      const retryPrompt = "Reply ONLY with valid JSON. No explanation, no markdown, no code fences:\n" +
        '{"buys":[{"symbol":"...","confidence":85,"reasoning":"..."}],"sells":[{"symbol":"...","reasoning":"..."}]}';
      try {
        const retryRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.deepseekApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "user", content: prompt },
              { role: "assistant", content: text },
              { role: "user", content: retryPrompt },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
          signal: controller.signal,
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json() as { choices: { message: { content: string } }[] };
          const retryText = (retryData.choices?.[0]?.message?.content ?? "").trim();
          decision = parseAIDecision(retryText);
        }
      } catch { /* retry failed, fall through */ }
    }

    if (!decision) {
      return { buys: [], sells: sellCandidates, error: `AI response parse error after retry: ${text.slice(0, 200)}` };
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
        score: Math.max(0, Math.min(100, Math.round(
          token.consensus * 0.35 +
          token.smartMoney * 0.25 +
          token.momentum * 0.20 +
          token.accumulation * 0.20
        ))),
      });
      seenSymbols.add(b.symbol);
    }

    // Sell strategy: union of rule-based sells + AI decisions
    const sells: AutoSellAction[] = [];
    const soldSymbols = new Set<string>();

    // 1a. Execute all rule-based sell candidates (safety net)
    for (const sc of sellCandidates) {
      sells.push(sc);
      soldSymbols.add(sc.trade.symbol);
    }

    // 1b. Execute AI-only sells (autonomy)
    if (decision.sells) {
      for (const aiSell of decision.sells) {
        const trade = trades.find((t) => t.symbol === aiSell.symbol);
        if (!trade) continue;
        if (soldSymbols.has(trade.symbol)) continue;
        const currentPrice = priceMap.get(trade.symbol) ?? trade.entryPrice;
        const pctChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
        const hoursHeld = (Date.now() - trade.timestamp) / (1000 * 60 * 60);
        sells.push({
          trade,
          currentPrice,
          recommendation: {
            action: "TREND_REVERSAL" as SellAction,
            reason: `[AI] ${aiSell.reasoning.slice(0, 120)}`,
            urgency: "medium" as Urgency,
            pctChange,
            hoursHeld,
          },
        });
        soldSymbols.add(trade.symbol);
      }
    }

    return { buys, sells };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { buys: [], sells: sellCandidates, error: "AI request timed out" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { buys: [], sells: sellCandidates, error: message };
  }
}
