import { fetchAllTokens } from "../src/lib/binance.js";

export default async function handler(): Promise<Response> {
  const steps: { step: string; ms: number }[] = [];
  const t0 = Date.now();

  try {
    const tokens = await fetchAllTokens();
    steps.push({ step: "fetchAllTokens", ms: Date.now() - t0 });
    return Response.json({ ok: true, count: tokens.length, steps });
  } catch (err) {
    steps.push({ step: "fetchAllTokens", ms: Date.now() - t0 });
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      steps,
    });
  }
}
