/**
 * Fetches market data from CoinGecko API and stores in Supabase.
 * Standalone script — runs on any Node.js with no external deps.
 *
 * Usage: node scripts/refresh-market-data.mjs
 * Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const CG_API = "https://api.coingecko.com/api/v3";

async function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchCG(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoinGecko ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const startedAt = Date.now();
  console.log("[refresh] Fetching market data from CoinGecko...");

  // Fetch top 100 coins by market cap (excludes stablecoins on CoinGecko side)
  const coins = await fetchCG(
    `${CG_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`
  );

  // Compute basic scores
  const maxCap = Math.max(...coins.filter(c => c.market_cap).map(c => c.market_cap), 1);
  const maxVol = Math.max(...coins.filter(c => c.total_volume).map(c => c.total_volume), 1);
  const maxChange = Math.max(...coins.map(c => Math.abs(c.price_change_percentage_24h ?? 0)), 1);

  const tokens = coins.map((c) => {
    const mcapScore = ((c.market_cap ?? 0) / maxCap) * 100;
    const volScore = Math.min(100, ((c.total_volume ?? 0) / maxVol) * 100);
    const changeScore = 50 + ((c.price_change_percentage_24h ?? 0) / maxChange) * 30;
    const momentum = Math.max(0, Math.min(100, Math.round(changeScore)));
    const smartMoney = Math.max(0, Math.min(100, Math.round(mcapScore * 0.6 + volScore * 0.4)));
    const consensus = Math.max(0, Math.min(100, Math.round(momentum * 0.4 + smartMoney * 0.4 + volScore * 0.2)));

    return {
      symbol: (c.symbol + "USDT").toUpperCase(),
      name: c.name,
      price: c.current_price ?? 0,
      volume24h: c.total_volume ?? 0,
      priceChange24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? 0,
      momentum,
      smartMoney,
      structure: Math.max(0, Math.min(100, Math.round(mcapScore * 0.5 + volScore * 0.5))),
      accumulation: Math.max(0, Math.min(100, Math.round(volScore * 0.7 + (c.price_change_percentage_24h ?? 0) * 0.5))),
      sentiment: Math.max(0, Math.min(100, Math.round(50 + (c.price_change_percentage_24h ?? 0) * 2))),
      mmFootprint: 50,
      consensus,
      tags: [],
    };
  }).filter((t) => t.price > 0);

  console.log(`[refresh] Fetched ${tokens.length} tokens`);

  // Store in Supabase
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

  console.log(`[refresh] Done (${tokens.length} tokens, ${Date.now() - startedAt}ms)`);
}

main().catch((err) => {
  console.error("[refresh] Failed:", err);
  process.exit(1);
});
