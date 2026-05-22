import type { PaperTrade, UserSettings, Scores } from "../../types";
import { getSellRecommendation, recommendationColor, recommendationBg } from "../../lib/sellRecommendation";
import type { SellRecommendation } from "../../lib/sellRecommendation";

interface Props {
  trades: PaperTrade[];
  prices: Map<string, number>;
  settings: UserSettings;
  scores: Map<string, { alpha: number; smartMoney: number; swing: number; accumulation: number; consensus: number }>;
  onRemove: (id: string) => void;
}

function recLabel(action: string): string {
  switch (action) {
    case "TAKE_PROFIT": return "SELL (TP)";
    case "STOP_LOSS": return "SELL (SL)";
    case "SCORE_DECAY": return "WARN";
    case "TIME_EXIT": return "EXIT";
    default: return "HOLD";
  }
}

export default function PaperPortfolio({ trades, prices, settings, scores, onRemove }: Props) {
  if (!trades.length) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary mb-4">
          No paper trades yet. Buy signals from the scanner to track performance.
        </p>
        <span className="text-label text-text-muted">
          Use the scanner to paper-buy tokens and monitor P&L here.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Paper Portfolio</span>
        <span className="text-label text-text-muted">
          {trades.length} open {trades.length === 1 ? "position" : "positions"}
        </span>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-right">Entry</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Net P&L</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-center">Signal</th>
              <th className="px-3 py-2 text-left text-[11px] max-w-[180px]">Reason</th>
              <th className="px-3 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => {
              const currentPrice = prices.get(t.symbol) ?? t.entryPrice;
              const currentScores = scores.get(t.symbol);
              const gross = (currentPrice - t.entryPrice) * t.quantity;
              const fees =
                (t.entryPrice * t.quantity * settings.buyFee) / 100 +
                (currentPrice * t.quantity * settings.sellFee) / 100;
              const tax = gross > 0 ? (gross * settings.taxRate) / 100 : 0;
              const net = gross - fees - tax;
              const pct = ((currentPrice - t.entryPrice) / t.entryPrice) * 100;

              const rec: SellRecommendation = currentScores
                ? getSellRecommendation(t, currentPrice, currentScores as Scores)
                : getSellRecommendation(t, currentPrice);

              return (
                <tr
                  key={t.id}
                  className="border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell"
                >
                  <td className="px-3 py-1 text-text-primary font-semibold">
                    {t.symbol.replace("USDT", "")}
                  </td>
                  <td className="px-3 py-1 text-text-secondary text-right tabular-nums">
                    ${t.entryPrice.toFixed(6)}
                  </td>
                  <td className="px-3 py-1 text-text-primary text-right tabular-nums">
                    ${currentPrice.toFixed(6)}
                  </td>
                  <td className="px-3 py-1 text-text-secondary text-right tabular-nums">
                    {t.quantity.toLocaleString()}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums font-semibold ${
                      net >= 0 ? "text-signal-green" : "text-signal-red"
                    }`}
                  >
                    {net >= 0 ? "+" : ""}${net.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right tabular-nums ${
                      pct >= 0 ? "text-signal-green" : "text-signal-red"
                    }`}
                  >
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold ${recommendationColor(rec.action)} ${recommendationBg(rec.action)}`}
                    >
                      {recLabel(rec.action)}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-label text-text-muted max-w-[180px] truncate" title={rec.reason}>
                    {rec.reason}
                  </td>
                  <td className="px-3 py-1 text-center">
                    <button
                      onClick={() => onRemove(t.id)}
                      className="text-text-muted hover:text-signal-red transition-colors text-label"
                      title="Remove trade"
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
