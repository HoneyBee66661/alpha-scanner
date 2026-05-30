import type { TokenRow } from '../types/index.js';
import { fetchAllTokens } from './binance.js';
import { generateMockTokens } from './mockData.js';

export type DataSource = "binance" | "supabase";

export interface FetchResult {
  tokens: TokenRow[];
  source: DataSource;
  isMock: boolean;
  error?: string;
}

function normalizeTokens(tokens: TokenRow[]): TokenRow[] {
  return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function fetchFromSupabase(): Promise<{ tokens: TokenRow[]; error?: string }> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    if (!supabaseUrl || !supabaseKey) {
      return { tokens: [], error: "Supabase not configured" };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("market_snapshots")
      .select("tokens")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !data) {
      return { tokens: [], error: error?.message ?? "No snapshot found" };
    }
    return { tokens: data.tokens as TokenRow[] };
  } catch (err) {
    return { tokens: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function fetchFromSource(
  source: DataSource
): Promise<FetchResult> {
  if (source === "supabase") {
    const supabaseResult = await fetchFromSupabase();
    if (supabaseResult.tokens.length > 0) {
      return {
        tokens: normalizeTokens(supabaseResult.tokens),
        source: "supabase",
        isMock: false,
      };
    }
  }

  try {
    const tokens = normalizeTokens(await fetchAllTokens());
    return { tokens, source: "binance", isMock: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Binance fetch failed";
    const tokens = normalizeTokens(generateMockTokens());
    return { tokens, source: "binance", isMock: true, error: msg };
  }
}

const LS_SOURCE = "ascan_datasource";

export function loadSourcePreference(): DataSource {
  try {
    const saved = localStorage.getItem(LS_SOURCE);
    if (saved === "binance" || saved === "supabase") return saved;
  } catch { /* localStorage unavailable */ }
  return "binance";
}

export function saveSourcePreference(source: DataSource): void {
  try {
    localStorage.setItem(LS_SOURCE, source);
  } catch { /* localStorage unavailable */ }
}
