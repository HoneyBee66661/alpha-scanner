import { createClient } from "@supabase/supabase-js";
import type { PaperTrade, UserSettings } from '../types/index.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(
  supabaseUrl || "http://localhost",
  supabaseKey || "anon-key"
);

export function isConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseKey.length > 0;
}

// ── Mapping helpers ──────────────────────────────────────────────────

function toDbTrade(t: PaperTrade) {
  return {
    id: t.id,
    symbol: t.symbol,
    entry_price: t.entryPrice,
    quantity: t.quantity,
    timestamp: t.timestamp,
    alpha_snapshot: t.momentumSnapshot,
    smart_money_snapshot: t.smartMoneySnapshot,
    swing_snapshot: t.structureSnapshot,
    accumulation_snapshot: t.accumulationSnapshot,
    sentiment_snapshot: t.sentimentSnapshot,
    consensus_snapshot: t.consensusSnapshot,
    trader: t.trader ?? "rules",
  };
}

function fromDbTrade(row: Record<string, unknown>): PaperTrade {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    entryPrice: Number(row.entry_price),
    quantity: Number(row.quantity),
    timestamp: Number(row.timestamp),
    momentumSnapshot: Number(row.alpha_snapshot ?? 0),
    smartMoneySnapshot: Number(row.smart_money_snapshot ?? 0),
    structureSnapshot: Number(row.swing_snapshot ?? 0),
    accumulationSnapshot: Number(row.accumulation_snapshot ?? 0),
    sentimentSnapshot: Number(row.sentiment_snapshot ?? 0),
    consensusSnapshot: Number(row.consensus_snapshot ?? 0),
    trader: (row.trader as "ai" | "rules") ?? "rules",
  };
}

function toDbSettings(s: UserSettings) {
  return {
    id: 1,
    buy_fee: s.buyFee,
    sell_fee: s.sellFee,
    tax_rate: s.taxRate,
    telegram_bot_token: s.telegramBotToken,
    telegram_chat_id: s.telegramChatId,
    auto_trade_enabled: s.autoTradeEnabled,
    auto_trade_max_positions: s.autoTradeMaxPositions,
    auto_trade_budget_per_trade: s.autoTradeBudgetPerTrade,
    paper_balance: s.paperBalance,
    ai_trade_enabled: s.aiTradeEnabled ?? false,
    ai_paper_balance: s.aiPaperBalance ?? 10000,
    ai_trade_max_positions: s.aiTradeMaxPositions ?? 5,
    ai_trade_budget_per_trade: s.aiTradeBudgetPerTrade ?? 100,
  };
}

function fromDbSettings(row: Record<string, unknown>): UserSettings {
  return {
    buyFee: Number(row.buy_fee),
    sellFee: Number(row.sell_fee),
    taxRate: Number(row.tax_rate),
    telegramBotToken: String(row.telegram_bot_token ?? ""),
    telegramChatId: String(row.telegram_chat_id ?? ""),
    autoTradeEnabled: Boolean(row.auto_trade_enabled ?? false),
    autoTradeMaxPositions: Number(row.auto_trade_max_positions ?? 5),
    autoTradeBudgetPerTrade: Number(row.auto_trade_budget_per_trade ?? 100),
    paperBalance: Number(row.paper_balance ?? 10000),
    aiTradeEnabled: Boolean(row.ai_trade_enabled ?? false),
    aiPaperBalance: Number(row.ai_paper_balance ?? 10000),
    aiTradeMaxPositions: Number(row.ai_trade_max_positions ?? 5),
    aiTradeBudgetPerTrade: Number(row.ai_trade_budget_per_trade ?? 100),
  };
}

// ── Paper Trades ─────────────────────────────────────────────────────

export async function fetchTrades(): Promise<PaperTrade[]> {
  const { data, error } = await supabase
    .from("paper_trades")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(fromDbTrade);
}

export async function upsertTrade(trade: PaperTrade): Promise<void> {
  const { error } = await supabase
    .from("paper_trades")
    .upsert(toDbTrade(trade));

  if (error) throw error;
}

export async function removeTrade(id: string): Promise<void> {
  const { error } = await supabase
    .from("paper_trades")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ── User Settings ────────────────────────────────────────────────────

export async function fetchSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data ? fromDbSettings(data) : null;
}

export async function upsertSettings(settings: UserSettings): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert(toDbSettings(settings));

  if (error) throw error;
}
