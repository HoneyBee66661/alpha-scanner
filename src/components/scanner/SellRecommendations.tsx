import type { PaperTrade, UserSettings, Scores } from "../../types";
import {
  rankSellRecommendations,
  recommendationColor,
  recommendationBg,
  recLabel,
  urgencyBadgeClass,
} from "../../lib/sellRecommendation";
import type { RankedSell, SellRecommendation } from "../../lib/sellRecommendation";

interface Props {
  trades: PaperTrade[];
  prices: Map<string, number>;
  scores: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>;
  settings: UserSettings;
  onSell: (trade: PaperTrade, rec: SellRecommendation, currentPrice: number) => void;
}

export default function SellRecommendations({ trades, prices, scores, settings, onSell }: Props) {
  const ranked: RankedSell[] = rankSellRecommendations(trades, prices, scores);

  // Count urgent sells (critical + high)
  const urgentCount = ranked.filter(
    (r) => r.recommendation.urgency === "critical" || r.recommendation.urgency === "high"
  ).length;

  if (trades.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary mb-4">
          No open positions. Buy signals first to see sell recommendations.
        </p>
        <span className="text-label text-text-muted">
          Open positions from paper trading will appear here with sell signals.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Sell Recommendations</span>
        {urgentCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-signal-redBg px-2 py-0.5 text-label font-semibold text-signal-red animate-pulse">
            {urgentCount} urgent
          </span>
        )}
        <span className="text-label text-text-muted">
          {ranked.filter((r) => r.recommendation.action !== "HOLD").length} sell signals
        </span>
      </div>

      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
              <th className="w-10 px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-right">Entry</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">P&L</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-center">Urgency</th>
              <th className="px-3 py-2 text-center">Signal</th>
              <th className="px-3 py-2 text-left max-w-[200px]">Reason</th>
              <th className="px-3 py-2 text-center w-14">Action</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ trade, recommendation, currentPrice }, i) => {
              const gross = (currentPrice - trade.entryPrice) * trade.quantity;
              const fees =
                (trade.entryPrice * trade.quantity * settings.buyFee) / 100 +
                (currentPrice * trade.quantity * settings.sellFee) / 100;
              const tax = gross > 0 ? (gross * settings.taxRate) / 100 : 0;
              const net = gross - fees - tax;
              const pct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;

              const isUrgent = recommendation.urgency === "critical" || recommendation.urgency === "high";

              return (
                <tr
                  key={trade.id}
                  className={`border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell ${
                    isUrgent ? "bg-signal-redBg/10" : ""
                  }`}
                >
                  <td className="px-3 py-1 text-text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1 text-text-primary font-semibold tabular-nums">
                    {trade.symbol.replace("USDT", "")}
                    <span className="text-text-muted font-normal">/USDT</span>
                  </td>
                  <td className="px-3 py-1 text-text-secondary text-right tabular-nums">
                    ${trade.entryPrice.toFixed(6)}
                  </td>
                  <td className="px-3 py-1 text-text-primary text-right tabular-nums">
                    ${currentPrice.toFixed(6)}
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
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold ${urgencyBadgeClass(recommendation.urgency)}`}
                    >
                      {recommendation.urgency !== "none" ? recommendation.urgency : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold ${recommendationColor(recommendation.action)} ${recommendationBg(recommendation.action)}`}
                    >
                      {recLabel(recommendation.action)}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-label text-text-muted max-w-[200px] truncate" title={recommendation.reason}>
                    {recommendation.reason}
                  </td>
                  <td className="px-3 py-1 text-center">
                    {recommendation.action !== "HOLD" && (
                      <button
                        onClick={() => onSell(trade, recommendation, currentPrice)}
                        className={`px-2 py-0.5 rounded text-label font-semibold transition-colors ${
                          isUrgent
                            ? "text-white bg-signal-red hover:bg-signal-red/80"
                            : "text-signal-yellow hover:bg-signal-yellowBg"
                        }`}
                        title="Execute sell"
                      >
                        Sell
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ranked.length === 0 && (
        <div className="flex items-center justify-center h-full text-text-muted text-body">
          <span>No positions to evaluate</span>
        </div>
      )}
    </div>
  );
}
