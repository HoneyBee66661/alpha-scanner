export default async function handler(): Promise<Response> {
  const steps: Record<string, unknown> = {};
  const t0 = Date.now();

  // Test 1: basic fetch with AbortController
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { signal: ctrl.signal });
    clearTimeout(id);
    const data = await res.json() as Record<string, unknown>;
    steps["binance_direct"] = { ok: true, status: res.status, price: data.lastPrice, ms: Date.now() - t0 };
  } catch (err) {
    steps["binance_direct"] = { ok: false, error: err instanceof Error ? err.message : String(err), name: err instanceof Error ? err.name : "", ms: Date.now() - t0 };
  }

  return Response.json({ ok: true, steps });
}
