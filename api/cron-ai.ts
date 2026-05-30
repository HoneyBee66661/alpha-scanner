import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchFromSource } from "../src/lib/dataSource.js";
import { runAITrader } from "../src/lib/aiTrader.js";
import { sendTelegramAlert, formatTradeAlert } from "../src/lib/telegram.js";
import type { PaperTrade, UserSettings } from "../src/types/index.js";
import { supabase } from "./_supabase.js";

function fromDbTrade(row: Record<string, unknown>): PaperTrade {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    entryPrice: Number(row.entry_price),
    quantity: Number(row.quantity),
    timestamp: Number(row.timestamp),
    momentumSnapshot: Number(row.alpha_snapshot ?? 0),
    smartMoneySnapshot: Number(row.smart_money_snapshot ?? 0),
    structureSnapshot: Number(row.swing_snapshot ?? 0),
    accumulationSnapshot: Number(row.accumulation_snapshot ?? 0),
    sentimentSnapshot: Number(row.sentiment_snapshot ?? 0),
    consensusSnapshot: Number(row.consensus_snapshot ?? 0),
    trader: (row.trader as "ai" | "rules") ?? "ai",
  };
}

function fromDbSettings(row: Record<string, unknown>): UserSettings {
  return {
    buyFee: Number(row.buy_fee ?? 0.1),
    sellFee: Number(row.sell_fee ?? 0.1),
    taxRate: Number(row.tax_rate ?? 0),
    telegramBotToken: String(row.telegram_bot_token ?? ""),
    telegramChatId: String(row.telegram_chat_id ?? ""),
    autoTradeEnabled: Boolean(row.auto_trade_enabled ?? false),
    autoTradeMaxPositions: Number(row.auto_trade_max_positions ?? 5),
    autoTradeBudgetPerTrade: Number(row.auto_trade_budget_per_trade ?? 100),
    paperBalance: Number(row.paper_balance ?? 10000),
    aiTradeEnabled: Boolean(row.ai_trade_enabled ?? false),
    aiPaperBalance: Number(row.ai_paper_balance ?? 10000),
    aiTradeMaxPositions: Number(row.ai_trade_max_positions ?? 5),
    aiTradeBudgetPerTrade: Number(row.ai_trade_budget_per_trade ?? 100),
  };
}

// ── Handler ────────────────────────────────────────────────────────────

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();

  try {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "";

    // 1. Load settings
    const { data: settingsRow, error: settingsErr } = await supabase
      .from("user_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsErr || !settingsRow) {
      return res.json(
        { ok: false, reason: "settings not found" },
      );
    }

    const settings = fromDbSettings(settingsRow);

    if (!settings.aiTradeEnabled) {
      return res.json(
        { ok: false, reason: "AI trade disabled" },
      );
    }

    if (!deepseekApiKey) {
      return res.json(
        { ok: false, reason: "DEEPSEEK_API_KEY not set" },
      );
    }

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.json(
        { ok: false, reason: "telegram not configured" },
      );
    }

    // 2. Load AI open trades only
    const { data: tradesRows, error: tradesErr } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("trader", "ai");

    if (tradesErr) {
      return res.json(
        { ok: false, reason: `trades fetch failed: ${tradesErr.message}` },
      );
    }

    const trades: PaperTrade[] = (tradesRows ?? []).map(fromDbTrade);

    // 3. Fetch token data (falls back to mock data when Binance is unreachable)
    const { tokens, isMock, error: sourceError } = await fetchFromSource("binance");

    tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

    // 4. Build lookup maps
    const priceMap = new Map<string, number>();
    const scoreMap = new Map<
      string,
      {
        momentum: number;
        smartMoney: number;
        structure: number;
        accumulation: number;
        sentiment: number;
        mmFootprint: number;
        consensus: number;
      }
    >();

    for (const t of tokens) {
      priceMap.set(t.symbol, t.price);
      scoreMap.set(t.symbol, {
        momentum: t.momentum,
        smartMoney: t.smartMoney,
        structure: t.structure,
        accumulation: t.accumulation,
        sentiment: t.sentiment,
        mmFootprint: t.mmFootprint,
        consensus: t.consensus,
      });
    }

    // Notify if using mock data
    if (isMock && settings.telegramBotToken && settings.telegramChatId) {
      const mockMsg = [
        `<b> AI Bot — Using Mock Data</b>`,
        `<b>Reason:</b> ${sourceError ?? "Binance unreachable from Vercel region"}`,
        `<b>Tokens:</b> ${tokens.length} (simulated)`,
        `<i>Trade signals will not reflect real market conditions</i>`,
        `<i>Alpha Scanner · ${new Date().toLocaleString()}</i>`,
      ].join("\n");
      await sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, mockMsg);
    }

    // 5. Run AI trader
    const { buys, sells, error: aiError } = await runAITrader(
      tokens,
      trades,
      priceMap,
      scoreMap,
      { deepseekApiKey },
      settings.aiPaperBalance,
      settings.aiTradeBudgetPerTrade,
      settings.aiTradeMaxPositions
    );

    // 6. Execute trades and send alerts
    let balance = settings.aiPaperBalance;
    const alerts: string[] = [];
    const executed: string[] = [];

    // Execute sells first (free up slots + credit balance)
    for (const { trade, recommendation, currentPrice } of sells) {
      await supabase.from("paper_trades").delete().eq("id", trade.id);
      const proceeds = currentPrice * trade.quantity;
      balance += proceeds;

      const pnl = ((currentPrice - trade.entryPrice) * trade.quantity).toFixed(2);
      const msg = formatTradeAlert(
        "SELL",
        trade.symbol,
        currentPrice,
        `[AI] ${recommendation.action}: ${recommendation.reason} (P&L: $${pnl})`
      );
      await sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg);
      alerts.push(`AI SELL ${trade.symbol}`);
      executed.push(`AI SELL ${trade.symbol} P&L $${pnl}`);
    }

    // Execute buys
    const heldSymbols = new Set(
      (await supabase.from("paper_trades").select("symbol").eq("trader", "ai").then((r) =>
        (r.data ?? []).map((t: Record<string, unknown>) => t.symbol as string)
      ))
    );

    const affordable = buys.filter(
      () => balance >= settings.aiTradeBudgetPerTrade
    );

    for (const { symbol, price, reason, score } of affordable) {
      if (heldSymbols.has(symbol)) continue;

      const budget = settings.aiTradeBudgetPerTrade;
      balance -= budget;

      const now = Date.now();
      const token = tokens.find((t) => t.symbol === symbol);
      const trade = {
        id: "ai_" + now.toString(36) + Math.random().toString(36).slice(2, 6),
        symbol,
        entry_price: price,
        quantity: budget / price,
        timestamp: now,
        alpha_snapshot: token?.momentum ?? 0,
        smart_money_snapshot: token?.smartMoney ?? 0,
        swing_snapshot: token?.structure ?? 0,
        accumulation_snapshot: token?.accumulation ?? 0,
        sentiment_snapshot: token?.sentiment ?? 0,
        consensus_snapshot: token?.consensus ?? 0,
        trader: "ai",
      };

      await supabase.from("paper_trades").upsert(trade);
      heldSymbols.add(symbol);

      const msg = formatTradeAlert("BUY", symbol, price, `[AI] ${reason} (Score: ${score})`);
      await sendTelegramAlert(settings.telegramBotToken, settings.telegramChatId, msg);
      alerts.push(`AI BUY ${symbol}`);
      executed.push(`AI BUY ${symbol} @ $${price.toFixed(4)}`);
    }

    // Send idle report if no trades were executed
    if (executed.length === 0) {
      const topTokens = tokens
        .sort((a, b) => b.consensus - a.consensus)
        .slice(0, 5)
        .map((t) => `${t.symbol} (${(t.consensus * 100).toFixed(0)}%)`)
        .join(", ");

      const idleMsg = [
        `<b> AI Scan Complete</b>`,
        `<b>Status:</b> No trade opportunities found`,
        `<b>Tokens scanned:</b> ${tokens.length}`,
        `<b>Open AI positions:</b> ${trades.length}`,
        `<b>AI Balance:</b> $${balance.toFixed(2)}`,
        topTokens ? `<b>Top picks:</b> ${topTokens}` : "",
        aiError ? `<b>AI note:</b> ${aiError}` : "",
        `<i>Alpha Scanner · ${new Date().toLocaleString()}</i>`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendTelegramAlert(
        settings.telegramBotToken,
        settings.telegramChatId,
        idleMsg
      );
    }

    // Update AI balance
    await supabase
      .from("user_settings")
      .upsert({ id: 1, ai_paper_balance: Math.round(balance * 100) / 100 });

    const elapsed = Date.now() - startedAt;

    return res.json({
      ok: true,
      source: "binance",
      trader: "ai",
      tokens: tokens.length,
      trades: trades.length,
      buys: affordable.length,
      sells: sells.length,
      alerts,
      executed,
      aiError: aiError ?? null,
      balance,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.json({ ok: false, error: message }, { status: 200 });
  }
}
