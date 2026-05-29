import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";
  const SECRET = process.env.CRON_SECRET ?? "";

  // Optional secret to prevent unauthorized calls
  if (SECRET && req.query.secret !== SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const { fetchFromSource } = await import("../src/lib/dataSource");
    const { sendTelegramAlert } = await import("../src/lib/telegram");
    const { getBuyRecommendation } = await import("../src/lib/buyRecommendation");

    const result = await fetchFromSource("binance");

    const lines: string[] = [
      `<b>🔍 Alpha Scanner — Cron Scan</b>`,
      `<i>${new Date().toLocaleString("id-ID")}</i>`,
      ``,
    ];

    if (result.isMock) {
      lines.push(`⚠️ <b>Mock data</b> — ${result.error ?? "API unreachable"}`);
      if (BOT_TOKEN && CHAT_ID) {
        await sendTelegramAlert(BOT_TOKEN, CHAT_ID, lines.join("\n"));
      }
      // Record mock-data run
      try {
        const { supabase } = await import("./_supabase");
        await supabase.from("cron_status").upsert(
          { id: 1, last_run_at: new Date().toISOString(), status: "mock", tokens_scanned: 0, strong_buys: 0, error: result.error ?? null },
          { onConflict: "id" }
        );
      } catch (_dbErr) { /* non-critical */ }
      return res.status(200).json({ ok: true, mock: true, tokens: 0 });
    }

    const { tokens } = result;

    lines.push(`<b>Tokens scanned:</b> ${tokens.length}`);

    // Top STRONG_BUY signals
    const strongBuys = tokens
      .map((t) => ({ token: t, rec: getBuyRecommendation(t) }))
      .filter(({ rec }) => rec.action === "STRONG_BUY")
      .sort((a, b) => b.rec.score - a.rec.score);

    if (strongBuys.length > 0) {
      lines.push(``);
      lines.push(`<b>🟢 STRONG BUY (${strongBuys.length})</b>`);
      for (const s of strongBuys.slice(0, 10)) {
        lines.push(`  ${s.token.symbol.replace("USDT", "")} · Score ${s.rec.score} · ${s.rec.reason}`);
      }
    }

    // Top 3 by consensus for quick overview
    const topConsensus = [...tokens].sort((a, b) => b.consensus - a.consensus).slice(0, 3);
    lines.push(``);
    lines.push(`<b>Top Consensus</b>`);
    for (const t of topConsensus) {
      lines.push(`  ${t.symbol.replace("USDT", "")} · C:${t.consensus} M:${t.momentum} SM:${t.smartMoney}`);
    }

    // Price leaders (top gainers)
    const topGainers = [...tokens].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 3);
    lines.push(``);
    lines.push(`<b>Top Gainers 24h</b>`);
    for (const t of topGainers) {
      lines.push(`  ${t.symbol.replace("USDT", "")} · ${t.priceChange24h.toFixed(1)}% · $${t.price.toFixed(t.price < 1 ? 6 : 4)}`);
    }

    if (BOT_TOKEN && CHAT_ID) {
      await sendTelegramAlert(BOT_TOKEN, CHAT_ID, lines.join("\n"));
    }

    // Record successful run in Supabase
    try {
      const { supabase } = await import("./_supabase");
      await supabase.from("cron_status").upsert(
        {
          id: 1,
          last_run_at: new Date().toISOString(),
          status: "success",
          tokens_scanned: tokens.length,
          strong_buys: strongBuys.length,
          error: null,
        },
        { onConflict: "id" }
      );
    } catch (_dbErr) {
      // Non-critical — don't break the response
    }

    return res.status(200).json({
      ok: true,
      tokensScanned: tokens.length,
      strongBuys: strongBuys.length,
      alerted: !!(BOT_TOKEN && CHAT_ID),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Cron scan error:", msg);

    // Record failed run
    try {
      const { supabase } = await import("./_supabase");
      await supabase.from("cron_status").upsert(
        {
          id: 1,
          last_run_at: new Date().toISOString(),
          status: "error",
          tokens_scanned: 0,
          strong_buys: 0,
          error: msg,
        },
        { onConflict: "id" }
      );
    } catch (_dbErr) {
      // Non-critical
    }

    // Return 200 so cron-job.org doesn't keep retrying
    return res.status(200).json({ ok: false, error: msg });
  }
}
