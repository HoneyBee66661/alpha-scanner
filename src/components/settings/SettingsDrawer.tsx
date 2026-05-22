import { useState } from "react";
import type { UserSettings } from "../../types";
import { sendTelegramAlert, formatTradeAlert } from "../../lib/telegram";

interface Props {
  settings: UserSettings;
  onSave: (s: UserSettings) => void;
}

export default function SettingsDrawer({ settings, onSave }: Props) {
  const [form, setForm] = useState<UserSettings>({ ...settings });

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto scroll-thin p-4 gap-6">
      <div>
        <h2 className="text-heading text-text-primary mb-1">Settings</h2>
        <p className="text-body text-text-muted">Configure fees, tax, and notification parameters.</p>
      </div>

      <div className="flex flex-col gap-4 max-w-md">
        <fieldset className="flex flex-col gap-3 border border-border rounded-lg p-4">
          <legend className="text-body text-text-secondary px-1">Trading Fees</legend>

          <label className="flex items-center gap-3">
            <span className="text-cell text-text-secondary w-20">Buy Fee %</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-24 rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary outline-none focus:border-border-focus"
              value={form.buyFee}
              onChange={(e) => update("buyFee", Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-3">
            <span className="text-cell text-text-secondary w-20">Sell Fee %</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-24 rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary outline-none focus:border-border-focus"
              value={form.sellFee}
              onChange={(e) => update("sellFee", Number(e.target.value))}
            />
          </label>

          <label className="flex items-center gap-3">
            <span className="text-cell text-text-secondary w-20">Tax %</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-24 rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary outline-none focus:border-border-focus"
              value={form.taxRate}
              onChange={(e) => update("taxRate", Number(e.target.value))}
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3 border border-border rounded-lg p-4">
          <legend className="text-body text-text-secondary px-1">Telegram Alerts</legend>

          <label className="flex flex-col gap-1">
            <span className="text-cell text-text-secondary">Bot Token</span>
            <input
              type="password"
              className="w-full rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary outline-none focus:border-border-focus"
              placeholder="123456:ABC-DEF..."
              value={form.telegramBotToken}
              onChange={(e) => update("telegramBotToken", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-cell text-text-secondary">Chat ID</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary outline-none focus:border-border-focus"
              placeholder="-100123456789"
              value={form.telegramChatId}
              onChange={(e) => update("telegramChatId", e.target.value)}
            />
          </label>
        </fieldset>

        <button
          onClick={() => onSave(form)}
          className="btn-primary self-start"
        >
          Save Settings
        </button>

        {form.telegramBotToken && form.telegramChatId && (
          <TestTelegramButton token={form.telegramBotToken} chatId={form.telegramChatId} />
        )}
      </div>
    </div>
  );
}

function TestTelegramButton({ token, chatId }: { token: string; chatId: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function test() {
    setStatus("sending");
    const msg = formatTradeAlert("BUY", "BTCUSDT", 87650.32, "Test alert from Alpha Scanner");
    const result = await sendTelegramAlert(token, chatId, msg);
    setStatus(result.ok ? "ok" : "error");
    if (!result.ok) setErrorMsg(result.error ?? "Unknown error");
    setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="mt-2">
      <button
        onClick={test}
        disabled={status === "sending"}
        className="px-3 py-1.5 rounded text-label border border-border text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : "Test Telegram Alert"}
      </button>
      {status === "ok" && <span className="ml-2 text-label text-signal-green">Sent!</span>}
      {status === "error" && <span className="ml-2 text-label text-signal-red">{errorMsg}</span>}
    </div>
  );
}
