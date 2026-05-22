import { isConfigured, supabase } from "./supabase";

const LS_KEY = "ascan_watchlist";

function loadLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(symbols: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(symbols));
  } catch { /* noop */ }
}

export async function fetchWatchlist(): Promise<string[]> {
  if (!isConfigured()) return loadLocal();

  const { data, error } = await supabase
    .from("watchlist")
    .select("symbol");

  if (error) {
    console.warn("Supabase watchlist fetch failed, using local", error);
    return loadLocal();
  }

  const symbols = (data ?? []).map((r) => r.symbol as string);
  saveLocal(symbols); // sync local
  return symbols;
}

export async function addToWatchlist(symbol: string): Promise<void> {
  const local = loadLocal();
  if (local.includes(symbol)) return;
  saveLocal([...local, symbol]);

  if (isConfigured()) {
    await supabase.from("watchlist").upsert({ symbol }).catch((e) =>
      console.warn("Supabase watchlist add failed", e)
    );
  }
}

export async function removeFromWatchlist(symbol: string): Promise<void> {
  const local = loadLocal().filter((s) => s !== symbol);
  saveLocal(local);

  if (isConfigured()) {
    await supabase.from("watchlist").delete().eq("symbol", symbol).catch((e) =>
      console.warn("Supabase watchlist remove failed", e)
    );
  }
}
