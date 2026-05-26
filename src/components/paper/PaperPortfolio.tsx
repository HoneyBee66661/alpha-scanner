import { useRef, useEffect, useState } from "react";
import type { PaperTrade, UserSettings, Scores, ClosedTrade } from "../../types";
import { getSellRecommendation, recommendationColor, recommendationBg, recLabel } from "../../lib/sellRecommendation";
import type { SellRecommendation } from "../../lib/sellRecommendation";
import { downloadCSV } from "../../lib/csv";
import { createChart, ColorType } from "lightweight-charts";
import { computeLevel } from "../../lib/gamification";
import type { GamificationState } from "../../lib/gamification";

interface Props {
  trades: PaperTrade[];
  prices: Map<string, number>;
  settings: UserSettings;
  scores: Map<string, { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number }>;
  onRemove: (id: string) => void;
  balance?: number;
  onSetBalance?: (balance: number) => void;
  gamification?: GamificationState;
}

export default function PaperPortfolio({ trades, prices, settings, scores, onRemove, balance, onSetBalance, gamification }: Props) {
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
              const headers = ["Symbol", "Entry Price", "Qty", "Entry Date", "Momentum", "Smart Money", "Structure", "Consensus"];
              const rows = trades.map((t) => [
                t.symbol, String(t.entryPrice), String(t.quantity),
                new Date(t.timestamp).toISOString(),
                String(t.momentumSnapshot), String(t.smartMoneySnapshot),
                String(t.structureSnapshot), String(t.consensusSnapshot),
              ]);
              downloadCSV("alpha-scanner-trades.csv", headers, rows);
            }}
            className="ml-auto px-2 py-0.5 rounded text-label text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Balance summary */}
      <BalanceBar
        balance={balance}
        trades={trades}
        prices={prices}
        onSetBalance={onSetBalance}
        gamification={gamification}
      />

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

function BalanceBar({
  balance,
  trades,
  prices,
  onSetBalance,
  gamification,
}: {
  balance?: number;
  trades: PaperTrade[];
  prices: Map<string, number>;
  onSetBalance?: (b: number) => void;
  gamification?: GamificationState;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const invested = trades.reduce((s, t) => s + t.entryPrice * t.quantity, 0);
  const positionValue = trades.reduce(
    (s, t) => s + (prices.get(t.symbol) ?? t.entryPrice) * t.quantity,
    0
  );
  const totalEquity = (balance ?? 0) + positionValue;
  const totalPnl = totalEquity - 10000; // P&L relative to initial $10k

  const level = gamification ? computeLevel(gamification.xp) : null;

  return (
    <div className="px-4 py-2 border-b border-border bg-surface-card/50">
      <div className="flex flex-wrap gap-3 items-center">
        {level && (
          <div className="flex items-center gap-2 mr-2 pr-2 border-r border-border">
            <div className="flex items-center justify-center w-7 h-7 rounded-full border border-signal-blue/60 text-[10px] font-bold text-signal-blue">
              {level.level}
            </div>
            <div className="flex flex-col">
              <span className="text-label font-semibold text-text-primary">{level.title}</span>
              <span className="text-[10px] text-text-muted">{gamification?.xp ?? 0} XP</span>
            </div>
          </div>
        )}
        <MiniStat label="Available" value={`$${(balance ?? 0).toFixed(2)}`} accent="text-signal-blue" />
        <MiniStat label="Invested" value={`$${invested.toFixed(2)}`} />
        <MiniStat label="Equity" value={`$${totalEquity.toFixed(2)}`} accent={totalPnl >= 0 ? "text-signal-green" : "text-signal-red"} />
        <MiniStat label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`} accent={totalPnl >= 0 ? "text-signal-green" : "text-signal-red"} />
        {onSetBalance && (
          <div className="ml-auto flex items-center gap-1">
            {editing ? (
              <>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-28 rounded border border-border bg-surface-input px-2 py-1 text-cell text-text-primary outline-none"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSetBalance(Number(editVal) || 0);
                      setEditing(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    onSetBalance(Number(editVal) || 0);
                    setEditing(false);
                  }}
                  className="px-2 py-1 rounded text-label bg-signal-greenBg text-signal-green hover:opacity-80"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    onSetBalance(10000);
                    setEditing(false);
                  }}
                  className="px-2 py-1 rounded text-label text-text-muted hover:text-text-primary"
                >
                  Reset $10k
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setEditVal(String(balance ?? 10000));
                  setEditing(true);
                }}
                className="px-2 py-1 rounded text-label text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
              >
                Set Balance
              </button>
            )}
          </div>
        )}
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
