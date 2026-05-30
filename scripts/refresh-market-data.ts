/**
 * Fetches market data from Binance via fetchAllTokens() and stores
 * a JSONB snapshot in Supabase via REST API (no WebSocket needed).
 * Intended to run on GitHub Actions every 10 minutes.
 *
 * Usage: npx tsx scripts/refresh-market-data.ts
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { fetchAllTokens } from "../src/lib/binance.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const startedAt = Date.now();

  console.log("[refresh] Fetching tokens from Binance...");
  const tokens = await fetchAllTokens();
  console.log(`[refresh] Fetched ${tokens.length} tokens`);

  if (tokens.length === 0) {
    console.error("[refresh] No tokens returned, aborting");
    process.exit(1);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ tokens }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[refresh] Supabase insert failed (${res.status}): ${text}`);
    process.exit(1);
  }

  // Prune old snapshots via REST
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/market_snapshots?select=id&order=id.desc&limit=500`,
    {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (listRes.ok) {
    const ids: { id: number }[] = await listRes.json();
    if (ids.length >= 500) {
      const keepIds = ids.map((r) => r.id);
      const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/market_snapshots?id=not.in.(${keepIds.join(",")})`,
        {
          method: "DELETE",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (!deleteRes.ok) {
        const text = await deleteRes.text().catch(() => "");
        console.warn(`[refresh] Prune failed (${deleteRes.status}): ${text}`);
      } else {
        console.log(`[refresh] Pruned old snapshots, keeping ${keepIds.length}`);
      }
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[refresh] Snapshot saved (${tokens.length} tokens, ${elapsed}ms)`);
}

main().catch((err) => {
  console.error("[refresh] Script failed:", err);
  process.exit(1);
});
