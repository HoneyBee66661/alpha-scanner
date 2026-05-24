import type { TokenRow } from "../types";

export type BuyAction = "STRONG_BUY" | "BUY" | "WATCH" | "AVOID";
export type BuyUrgency = "high" | "medium" | "low" | "none";

export interface BuyRecommendation {
  action: BuyAction;
  reason: string;
  urgency: BuyUrgency;
  score: number;
}

const CONSENSUS_LEVELS: { threshold: number; urgency: BuyUrgency; action: BuyAction }[] = [
  { threshold: 85, urgency: "high", action: "STRONG_BUY" },
  { threshold: 75, urgency: "medium", action: "BUY" },
  { threshold: 60, urgency: "low", action: "WATCH" },
];

export function getBuyRecommendation(token: TokenRow): BuyRecommendation {
  const { consensus, momentum, smartMoney, accumulation, priceChange24h, volume24h } = token;

  // Penalise tokens that have already pumped hard
  const pumpPenalty = priceChange24h > 10 ? (priceChange24h - 10) * 2 : 0;
  const pumpFlag = priceChange24h > 15;

  // Reward healthy volume (relative to typical — we infer from the consensus strength)
  const volBonus = volume24h > 1e9 ? 5 : volume24h > 5e8 ? 2 : 0;

  // Compute composite buy score
  const rawScore =
    consensus * 0.35 +
    smartMoney * 0.25 +
    momentum * 0.20 +
    accumulation * 0.20 +
    volBonus -
    pumpPenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Check consensus-based thresholds first
  for (const level of CONSENSUS_LEVELS) {
    if (consensus >= level.threshold && !pumpFlag) {
      const parts: string[] = [];
      if (smartMoney >= 75) parts.push("smart money active");
      if (accumulation >= 70) parts.push("accumulation detected");
      if (momentum >= 80) parts.push("momentum building");
      const signal = parts.length ? ` — ${parts.join(", ")}` : "";
      return { action: level.action, reason: `Consensus ${consensus}${signal}`, urgency: level.urgency, score };
    }
  }

  // Pumped too hard — avoid
  if (pumpFlag) {
    return {
      action: "AVOID",
      reason: `Pumped ${priceChange24h.toFixed(1)}% in 24h — risk of pullback`,
      urgency: "none",
      score,
    };
  }

  // Low consensus — avoid
  if (consensus < 40) {
    return {
      action: "AVOID",
      reason: `Low consensus (${consensus}) — insufficient signal`,
      urgency: "none",
      score,
    };
  }

  // Mixed signals — watch
  if (consensus >= 60) {
    return {
      action: "WATCH",
      reason: `Moderate consensus (${consensus}) — wait for confirmation`,
      urgency: "low",
      score,
    };
  }

  // Fallback
  return {
    action: "WATCH",
    reason: `Below threshold — monitor for improvement`,
    urgency: "none",
    score,
  };
}

export function getTopBuyRecommendations(
  tokens: TokenRow[],
  limit = 20
): (BuyRecommendation & { symbol: string; price: number; tags: string[] })[] {
  return tokens
    .map((t) => ({ ...getBuyRecommendation(t), symbol: t.symbol.replace("USDT", ""), price: t.price, tags: t.tags }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buyActionColor(action: BuyAction): string {
  switch (action) {
    case "STRONG_BUY": return "text-signal-green";
    case "BUY": return "text-signal-green";
    case "WATCH": return "text-signal-yellow";
    case "AVOID": return "text-signal-red";
  }
}

export function buyActionBg(action: BuyAction): string {
  switch (action) {
    case "STRONG_BUY": return "bg-signal-greenBg";
    case "BUY": return "bg-signal-greenBg";
    case "WATCH": return "bg-signal-yellowBg";
    case "AVOID": return "bg-signal-redBg";
  }
}

export function buyActionLabel(action: BuyAction): string {
  switch (action) {
    case "STRONG_BUY": return "STRONG BUY";
    case "BUY": return "BUY";
    case "WATCH": return "WATCH";
    case "AVOID": return "AVOID";
  }
}
