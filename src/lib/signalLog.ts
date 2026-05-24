import { isConfigured, supabase } from "./supabase";

export interface SignalLogEntry {
  id?: number;
  symbol: string;
  event: string;
  details: string;
  timestamp: number;
}

const LS_KEY = "ascan_signal_log";

function loadLocal(): SignalLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveLocal(entries: SignalLogEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch { /* noop */ }
}

export async function fetchSignalLog(): Promise<SignalLogEntry[]> {
  if (!isConfigured()) return loadLocal();

  const { data, error } = await supabase
    .from("signal_log")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("Supabase signal_log fetch failed", error);
    return loadLocal();
  }

  const entries = (data ?? []).map((r: any) => ({
    id: r.id,
    symbol: r.symbol,
    event: r.event,
    details: r.details,
    timestamp: Number(r.timestamp),
  }));
  saveLocal(entries.slice(0, 100));
  return entries;
}

export async function addSignalLog(symbol: string, event: string, details: string): Promise<SignalLogEntry> {
  const entry: SignalLogEntry = {
    id: Date.now(),
    symbol,
    event,
    details,
    timestamp: Date.now(),
  };

  // Always save locally
  const local = loadLocal();
  local.unshift(entry);
  saveLocal(local.slice(0, 200));

  // Fire-and-forget to Supabase
  if (isConfigured()) {
    await supabase.from("signal_log").insert({
      symbol,
      event,
      details,
      timestamp: entry.timestamp,
    }).catch((e) => console.warn("Supabase signal_log insert failed", e));
  }

  return entry;
}
