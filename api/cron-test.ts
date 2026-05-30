import { fetchFromSource } from "../src/lib/dataSource.js";

export default async function handler(): Promise<Response> {
  const t0 = Date.now();
  const result = await fetchFromSource("binance");
  const elapsed = Date.now() - t0;

  return Response.json({
    ok: true,
    mock: result.isMock,
    count: result.tokens.length,
    error: result.error ?? null,
    elapsedMs: elapsed,
    sampleToken: result.tokens[0] ?? null,
  });
}
