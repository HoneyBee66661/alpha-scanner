/**
 * Fetches market data from Binance API and stores in Supabase.
 * Standalone script with no project dependencies — runs on any Node.js.
 *
 * Usage: node scripts/refresh-market-data.mjs
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const BINANCE_SPOT = "https://api.binance.com/api/v3";
const FETCH_TIMEOUT = 15000;

async function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAllTokens() {
  const tickerRes = await fetchWithTimeout(`${BINANCE_SPOT}/ticker/24hr`);
  if (!tickerRes.ok) throw new Error(`Binance ticker failed: ${tickerRes.status}`);
  const all = await tickerRes.json();
  const STABLECOINS = new Set(["USDC", "USDT", "BUSD", "DAI", "FDUSD", "TUSD", "PAX", "USDP", "GUSD", "HUSD", "USDN", "FEI", "FRAX", "LUSD", "MIM", "ALUSD", "USTC", "EURS", "CEUR", "EURT", "EURC", "SBD", "XDR"]);
  const EXCLUDED = new Set(["DOWN", "UP", "BULL", "BEAR", "LUNA", "LUNA2", "UST"]);

  const filtered = all.filter((t) => {
    const sym = String(t.symbol ?? "");
    if (!sym.endsWith("USDT")) return false;
    const base = sym.slice(0, -4);
    if (STABLECOINS.has(base)) return false;
    if (EXCLUDED.has(base)) return false;
    return true;
  });

  const top = filtered
    .sort((a, b) => Number(b.quoteVolume ?? 0) - Number(a.quoteVolume ?? 0))
    .slice(0, 50);

  return top.map((t) => ({
    symbol: t.symbol,
    price: Number(t.lastPrice ?? 0),
    volume24h: Number(t.quoteVolume ?? 0),
    priceChange24h: Number(t.priceChangePercent ?? 0),
  }));
}

async function main() {
  const startedAt = Date.now();

  console.log("[refresh] Fetching tokens from Binance...");
  const tokens = await fetchAllTokens();
  console.log(`[refresh] Fetched ${tokens.length} tokens`);

  if (tokens.length === 0) {
    console.error("[refresh] No tokens returned");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ tokens, fetched_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase insert failed (${res.status}): ${text}`);
  }

  // Prune old snapshots
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/market_snapshots?select=id&order=id.desc&limit=500`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  if (listRes.ok) {
    const ids = await listRes.json();
    if (ids.length >= 500) {
      const keepIds = ids.map(r => r.id);
      await fetch(`${SUPABASE_URL}/rest/v1/market_snapshots?id=not.in.(${keepIds.join(",")})`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
      });
    }
  }

  console.log(`[refresh] Done (${tokens.length} tokens, ${Date.now() - startedAt}ms)`);
}

main().catch((err) => {
  console.error("[refresh] Failed:", err);
  process.exit(1);
});
