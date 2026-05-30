/**
 * Fetches market data from Binance via fetchAllTokens() and stores
 * a JSONB snapshot in Supabase. Intended to run on GitHub Actions
 * every 10 minutes.
 *
 * Usage: npx tsx scripts/refresh-market-data.ts
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { fetchAllTokens } from "../src/lib/binance.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const startedAt = Date.now();

  console.log("[refresh] Fetching tokens from Binance...");
  const tokens = await fetchAllTokens();
  console.log(`[refresh] Fetched ${tokens.length} tokens`);

  if (tokens.length === 0) {
    console.error("[refresh] No tokens returned, aborting");
    process.exit(1);
  }

  const { error: insertError } = await supabase
    .from("market_snapshots")
    .insert({ tokens });

  if (insertError) {
    console.error("[refresh] Failed to insert snapshot:", insertError.message);
    process.exit(1);
  }

  // Prune old snapshots — keep latest 500 (~3.5 days at 10-min intervals)
  const { data: ids } = await supabase
    .from("market_snapshots")
    .select("id")
    .order("id", { ascending: false })
    .limit(500);

  if (ids && ids.length >= 500) {
    const keepIds = ids.map((r) => r.id);
    await supabase.from("market_snapshots").delete().not("id", "in", `(${keepIds.join(",")})`);
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[refresh] Snapshot saved (${tokens.length} tokens, ${elapsed}ms)`);
}

main().catch((err) => {
  console.error("[refresh] Script failed:", err);
  process.exit(1);
});
