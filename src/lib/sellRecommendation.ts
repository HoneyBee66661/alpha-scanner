import type { PaperTrade, Scores } from "../types";

export type SellAction =
  | "HOLD"
  | "TAKE_PROFIT"
  | "STOP_LOSS"
  | "SCORE_DECAY"
  | "TIME_EXIT";

export type Urgency = "none" | "low" | "medium" | "high";

export interface SellRecommendation {
  action: SellAction;
  reason: string;
  urgency: Urgency;
  pctChange: number;
  scoreDecay?: number;
  hoursHeld?: number;
}

const TP_TARGETS: { threshold: number; urgency: Urgency }[] = [
  { threshold: 20, urgency: "high" },
  { threshold: 10, urgency: "medium" },
  { threshold: 5, urgency: "low" },
];

const SL_LEVELS: { threshold: number; urgency: Urgency }[] = [
  { threshold: -15, urgency: "high" },
  { threshold: -7, urgency: "medium" },
  { threshold: -3, urgency: "low" },
];

const DECAY_LEVELS: { threshold: number; urgency: Urgency }[] = [
  { threshold: 35, urgency: "high" },
  { threshold: 20, urgency: "medium" },
  { threshold: 10, urgency: "low" },
];

const MAX_HOLD_HOURS = 168; // 7 days
const WARN_HOLD_HOURS = 72; // 3 days

export function getSellRecommendation(
  trade: PaperTrade,
  currentPrice: number,
  currentScores?: Scores
): SellRecommendation {
  const pctChange =
    ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const hoursHeld =
    (Date.now() - trade.timestamp) / (1000 * 60 * 60);

  for (const tp of TP_TARGETS) {
    if (pctChange >= tp.threshold) {
      return {
        action: "TAKE_PROFIT",
        reason: `+${tp.threshold}% profit target hit (+${pctChange.toFixed(1)}%)`,
        urgency: tp.urgency,
        pctChange,
        hoursHeld,
      };
    }
  }

  for (const sl of SL_LEVELS) {
    if (pctChange <= sl.threshold) {
      return {
        action: "STOP_LOSS",
        reason: `${sl.threshold}% stop level breached (${pctChange.toFixed(1)}%)`,
        urgency: sl.urgency,
        pctChange,
        hoursHeld,
      };
    }
  }

  if (currentScores) {
    const decay = trade.consensusSnapshot - currentScores.consensus;
    for (const d of DECAY_LEVELS) {
      if (decay >= d.threshold) {
        return {
          action: "SCORE_DECAY",
          reason: `Consensus dropped ${decay}pts from entry (${trade.consensusSnapshot} → ${currentScores.consensus})`,
          urgency: d.urgency,
          pctChange,
          scoreDecay: decay,
          hoursHeld,
        };
      }
    }
  }

  if (hoursHeld > MAX_HOLD_HOURS) {
    return {
      action: "TIME_EXIT",
      reason: `Held >7 days without hitting targets (${hoursHeld.toFixed(0)}h)`,
      urgency: "medium",
      pctChange,
      hoursHeld,
    };
  }

  if (hoursHeld > WARN_HOLD_HOURS && pctChange < 2) {
    return {
      action: "HOLD",
      reason: `Held ${hoursHeld.toFixed(0)}h with minimal movement — consider reviewing`,
      urgency: "low",
      pctChange,
      hoursHeld,
    };
  }

  return {
    action: "HOLD",
    reason: "Within target range — continue holding",
    urgency: "none",
    pctChange,
    hoursHeld,
  };
}

export function recommendationColor(action: SellAction): string {
  switch (action) {
    case "TAKE_PROFIT":
      return "text-signal-green";
    case "STOP_LOSS":
    case "SCORE_DECAY":
      return "text-signal-red";
    case "TIME_EXIT":
      return "text-signal-yellow";
    default:
      return "text-text-secondary";
  }
}

export function recommendationBg(action: SellAction): string {
  switch (action) {
    case "TAKE_PROFIT":
      return "bg-signal-greenBg";
    case "STOP_LOSS":
    case "SCORE_DECAY":
      return "bg-signal-redBg";
    case "TIME_EXIT":
      return "bg-signal-yellowBg";
    default:
      return "";
  }
}
