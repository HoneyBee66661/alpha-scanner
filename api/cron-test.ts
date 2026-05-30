export default async function handler(): Promise<Response> {
  const steps: Record<string, number> = {};
  const t0 = Date.now();

  // Test basic connectivity
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", { signal: ctrl.signal });
    clearTimeout(id);
    steps["binance_ticker"] = Date.now() - t0;
    const data = await res.json() as Record<string, unknown>;
    return Response.json({ ok: true, status: res.status, symbol: data.symbol, price: data.lastPrice, steps });
  } catch (err) {
    steps["binance_ticker"] = Date.now() - t0;
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : "Unknown",
      steps,
    });
  }
}
