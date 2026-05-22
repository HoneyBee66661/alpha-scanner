export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, error: "Bot token or chat ID not configured" };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram API error ${res.status}: ${body}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export function formatTradeAlert(
  type: "BUY" | "SELL" | "REMOVE",
  symbol: string,
  price: number,
  extra?: string
): string {
  const emoji = type === "BUY" ? "🟢" : type === "SELL" ? "🔴" : "⚪";
  const lines = [
    `<b>${emoji} ${type} Signal</b>`,
    `<b>Symbol:</b> ${symbol}`,
    `<b>Price:</b> $${price.toFixed(4)}`,
  ];
  if (extra) lines.push(`<b>Details:</b> ${extra}`);
  lines.push(`<i>Alpha Scanner · ${new Date().toLocaleString()}</i>`);
  return lines.join("\n");
}
