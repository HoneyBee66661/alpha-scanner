import { useRef, useEffect } from "react";
import type { PaperTrade, UserSettings, Scores } from "../../types";
import { getSellRecommendation, recommendationColor, recommendationBg } from "../../lib/sellRecommendation";
import type { SellRecommendation } from "../../lib/sellRecommendation";
import { downloadCSV } from "../../lib/csv";
import { createChart, ColorType } from "lightweight-charts";

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
        {trades.length > 0 && (
          <button
            onClick={() => {
              const headers = ["Symbol", "Entry Price", "Qty", "Entry Date", "Alpha", "Smart Money", "Swing", "Consensus"];
              const rows = trades.map((t) => [
                t.symbol, String(t.entryPrice), String(t.quantity),
                new Date(t.timestamp).toISOString(),
                String(t.alphaSnapshot), String(t.smartMoneySnapshot),
                String(t.swingSnapshot), String(t.consensusSnapshot),
              ]);
              downloadCSV("alpha-scanner-trades.csv", headers, rows);
            }}
            className="ml-auto px-2 py-0.5 rounded text-label text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* P&L summary cards */}
      {trades.length > 0 && <PnLSummary trades={trades} prices={prices} />}

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

function PnLSummary({ trades, prices }: { trades: PaperTrade[]; prices: Map<string, number> }) {
  const returns = trades.map((t) => {
    const current = prices.get(t.symbol) ?? t.entryPrice;
    const gross = (current - t.entryPrice) * t.quantity;
    const pct = ((current - t.entryPrice) / t.entryPrice) * 100;
    return { symbol: t.symbol, gross, pct };
  });

  const totalPnL = returns.reduce((s, r) => s + r.gross, 0);
  const wins = returns.filter((r) => r.gross > 0).length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;
  const best = returns.length ? Math.max(...returns.map((r) => r.pct)) : 0;
  const worst = returns.length ? Math.min(...returns.map((r) => r.pct)) : 0;

  return (
    <div className="px-4 py-3 border-b border-border bg-surface-card/50">
      <div className="flex flex-wrap gap-3 mb-3">
        <MiniStat label="Total P&L" value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`} accent={totalPnL >= 0 ? "text-signal-green" : "text-signal-red"} />
        <MiniStat label="Win Rate" value={`${winRate}%`} accent={winRate >= 50 ? "text-signal-green" : "text-signal-red"} />
        <MiniStat label="Best" value={`+${best.toFixed(2)}%`} accent="text-signal-green" />
        <MiniStat label="Worst" value={`${worst.toFixed(2)}%`} accent="text-signal-red" />
        <MiniStat label="Trades" value={String(trades.length)} />
      </div>
      {/* P&L bar chart */}
      <PnLChart returns={returns} />
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[80px]">
      <span className="text-label text-text-muted">{label}</span>
      <span className={`text-body font-semibold tabular-nums ${accent ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
}

function PnLChart({ returns }: { returns: { symbol: string; gross: number; pct: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnsKey = JSON.stringify(returns.map((r) => [r.symbol, r.gross.toFixed(2), r.pct.toFixed(2)]));

  useEffect(() => {
    if (!ref.current || !returns.length) return;

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#888",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#2a2a2e" },
        horzLines: { color: "#2a2a2e" },
      },
      width: ref.current.clientWidth,
      height: 120,
      crosshair: { mode: 0 },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
    });

    const series = chart.addHistogramSeries({
      color: "#22c55e",
      priceFormat: { type: "volume" },
    });

    series.setData(
      returns.map((r, i) => ({
        time: i as any,
        value: Math.abs(r.gross),
        color: r.gross >= 0 ? "#22c55e80" : "#ef444480",
      }))
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnsKey]);

  if (!returns.length) return null;
  return (
    <div className="mt-1">
      <span className="text-label text-text-muted block mb-1">P&L per Trade</span>
      <div ref={ref} className="w-full rounded" />
    </div>
  );
}
