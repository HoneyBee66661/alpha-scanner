import { createClient } from "@supabase/supabase-js";
import type { PaperTrade, UserSettings } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createClient(supabaseUrl || "http://localhost", supabaseKey || "anon-key");
  }
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    const client = getClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

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
    alpha_snapshot: t.alphaSnapshot,
    smart_money_snapshot: t.smartMoneySnapshot,
    swing_snapshot: t.swingSnapshot,
    consensus_snapshot: t.consensusSnapshot,
  };
}

function fromDbTrade(row: Record<string, unknown>): PaperTrade {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    entryPrice: Number(row.entry_price),
    quantity: Number(row.quantity),
    timestamp: Number(row.timestamp),
    alphaSnapshot: Number(row.alpha_snapshot),
    smartMoneySnapshot: Number(row.smart_money_snapshot),
    swingSnapshot: Number(row.swing_snapshot),
    consensusSnapshot: Number(row.consensus_snapshot),
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
  };
}

function fromDbSettings(row: Record<string, unknown>): UserSettings {
  return {
    buyFee: Number(row.buy_fee),
    sellFee: Number(row.sell_fee),
    taxRate: Number(row.tax_rate),
    telegramBotToken: String(row.telegram_bot_token ?? ""),
    telegramChatId: String(row.telegram_chat_id ?? ""),
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
