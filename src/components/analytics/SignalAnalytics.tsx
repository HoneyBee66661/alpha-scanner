import { useMemo, useRef, useEffect } from "react";
import type { PaperTrade, ClosedTrade } from "../../types";
import { computeAnalytics } from "../../lib/analytics";
import { createChart, ColorType } from "lightweight-charts";

interface Props {
  trades: PaperTrade[];
  prices: Map<string, number>;
  closedTrades?: ClosedTrade[];
  balance?: number;
}

interface ScoreCorrelation {
  score: string;
  avgReturnHigh: number;
  avgReturnLow: number;
  winRateHigh: number;
  winRateLow: number;
  signalCountHigh: number;
  signalCountLow: number;
}

function computeCorrelations(trades: PaperTrade[], prices: Map<string, number>): ScoreCorrelation[] {
  if (trades.length < 4) return [];
  const scores = [
    { key: "momentumSnapshot" as const, label: "Momentum" },
    { key: "smartMoneySnapshot" as const, label: "Smart Money" },
    { key: "structureSnapshot" as const, label: "Structure" },
    { key: "consensusSnapshot" as const, label: "Consensus" },
  ];
  return scores.map(({ key, label }) => {
    const withReturns = trades.map((t) => {
      const current = prices.get(t.symbol) ?? t.entryPrice;
      const pct = ((current - t.entryPrice) / t.entryPrice) * 100;
      return { score: t[key], pct };
    });
    const median = withReturns.sort((a, b) => a.score - b.score)[Math.floor(withReturns.length / 2)].score;
    const high = withReturns.filter((w) => w.score >= median);
    const low = withReturns.filter((w) => w.score < median);
    return {
      score: label,
      avgReturnHigh: high.length > 0 ? parseFloat((high.reduce((s, w) => s + w.pct, 0) / high.length).toFixed(2)) : 0,
      avgReturnLow: low.length > 0 ? parseFloat((low.reduce((s, w) => s + w.pct, 0) / low.length).toFixed(2)) : 0,
      winRateHigh: high.length > 0 ? Math.round((high.filter((w) => w.pct > 0).length / high.length) * 100) : 0,
      winRateLow: low.length > 0 ? Math.round((low.filter((w) => w.pct > 0).length / low.length) * 100) : 0,
      signalCountHigh: high.length,
      signalCountLow: low.length,
    };
  });
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card flex flex-col gap-1 min-w-[140px]">
      <span className="text-label text-text-muted">{label}</span>
      <span className={`text-heading tabular-nums ${accent ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
}

export default function SignalAnalytics({ trades, prices, closedTrades, balance }: Props) {
  const metrics = useMemo(() => {
    if (!closedTrades?.length) return null;
    return computeAnalytics(closedTrades);
  }, [closedTrades]);

  const correlations = useMemo(() => computeCorrelations(trades, prices), [trades, prices]);

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-auto scroll-thin">
      <div>
        <h2 className="text-heading text-text-primary mb-1">Trading Analytics</h2>
        <p className="text-body text-text-muted">
          {metrics ? `${metrics.totalTrades} closed trades analyzed` : "Close paper trades to see performance analytics."}
        </p>
      </div>

      {metrics && (
        <>
          {/* Performance metrics */}
          <div className="flex flex-wrap gap-3">
            <MiniStat label="Win Rate" value={`${metrics.winRate}%`} accent={metrics.winRate >= 50 ? "text-signal-green" : "text-signal-red"} />
            <MiniStat label="Profit Factor" value={metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)} accent={metrics.profitFactor >= 1.5 ? "text-signal-green" : metrics.profitFactor >= 1 ? "text-text-primary" : "text-signal-red"} />
            <MiniStat label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(2)} accent={metrics.sharpeRatio >= 1 ? "text-signal-green" : "text-text-secondary"} />
            <MiniStat label="Expectancy" value={`$${metrics.expectancy.toFixed(2)}`} accent={metrics.expectancy >= 0 ? "text-signal-green" : "text-signal-red"} />
            <MiniStat label="Total Net P&L" value={`${metrics.totalNetPnl >= 0 ? "+" : ""}$${metrics.totalNetPnl.toFixed(2)}`} accent={metrics.totalNetPnl >= 0 ? "text-signal-green" : "text-signal-red"} />
          </div>

          {/* Risk metrics */}
          <div className="flex flex-wrap gap-3">
            <MiniStat label="Max Drawdown" value={`$${metrics.maxDrawdown.toFixed(2)}`} accent="text-signal-red" />
            <MiniStat label="Avg Win" value={`$${metrics.avgWin.toFixed(2)}`} accent="text-signal-green" />
            <MiniStat label="Avg Loss" value={`$${metrics.avgLoss.toFixed(2)}`} accent="text-signal-red" />
            <MiniStat label="Recovery Factor" value={metrics.recoveryFactor === Infinity ? "∞" : metrics.recoveryFactor.toFixed(2)} accent={metrics.recoveryFactor >= 1 ? "text-signal-green" : "text-text-secondary"} />
            <MiniStat label="Avg Hold" value={`${metrics.avgHoldHours.toFixed(1)}h`} />
          </div>

          {/* Streaks */}
          <div className="flex flex-wrap gap-3">
            <MiniStat label="Win Streak" value={metrics.winStreak} accent={metrics.winStreak >= 3 ? "text-signal-green" : "text-text-primary"} />
            <MiniStat label="Loss Streak" value={metrics.lossStreak} accent={metrics.lossStreak >= 3 ? "text-signal-red" : "text-text-primary"} />
            <MiniStat label="Best Win Streak" value={metrics.bestWinStreak} accent="text-signal-green" />
            <MiniStat label="Worst Loss Streak" value={metrics.worstLossStreak} accent="text-signal-red" />
            <MiniStat label="Best Return" value={`+${metrics.bestReturn.toFixed(2)}%`} accent="text-signal-green" />
            <MiniStat label="Worst Return" value={`${metrics.worstReturn.toFixed(2)}%`} accent="text-signal-red" />
          </div>

          {/* Cumulative PnL Chart */}
          {metrics.cumulativePnl.length >= 2 && (
            <CumulativePnlChart data={metrics.cumulativePnl} />
          )}

          {/* Closed trade detail */}
          <div>
            <h3 className="text-body text-text-secondary mb-2">Closed Trades</h3>
            <div className="overflow-auto scroll-thin">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-row text-label text-text-secondary">
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-right">Entry</th>
                    <th className="px-3 py-2 text-right">Exit</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                    <th className="px-3 py-2 text-right">Return</th>
                    <th className="px-3 py-2 text-center">Reason</th>
                    <th className="px-3 py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades?.map((t) => (
                    <tr key={t.id} className="border-b border-border text-cell hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1 text-text-primary font-semibold">{t.symbol.replace("USDT", "")}</td>
                      <td className="px-3 py-1 text-text-secondary text-right tabular-nums">${t.entryPrice.toFixed(6)}</td>
                      <td className="px-3 py-1 text-text-primary text-right tabular-nums">${t.exitPrice.toFixed(6)}</td>
                      <td className={`px-3 py-1 text-right tabular-nums font-semibold ${t.netPnl >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                        {t.netPnl >= 0 ? "+" : ""}{t.netPnl.toFixed(2)}
                      </td>
                      <td className={`px-3 py-1 text-right tabular-nums ${t.netReturnPct >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                        {t.netReturnPct >= 0 ? "+" : ""}{t.netReturnPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-1 text-center">
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold text-text-muted bg-surface-row">
                          {t.exitReason.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-1 text-text-muted text-right tabular-nums">
                        {new Date(t.exitTimestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Score Correlation */}
      {correlations.length > 0 && (
        <div className="mt-2">
          <h3 className="text-body text-text-secondary mb-3">Score Model Correlation</h3>
          <p className="text-label text-text-muted mb-3">
            Splits trades into high vs low score groups (above/below median). Compares which scores are most predictive.
          </p>
          <div className="overflow-auto scroll-thin">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-row text-label text-text-secondary">
                  <th className="px-3 py-2 text-left">Score Model</th>
                  <th className="px-3 py-2 text-right">Avg Return (High)</th>
                  <th className="px-3 py-2 text-right">Avg Return (Low)</th>
                  <th className="px-3 py-2 text-right">Win Rate (High)</th>
                  <th className="px-3 py-2 text-right">Win Rate (Low)</th>
                  <th className="px-3 py-2 text-right">Trades High/Low</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((c) => {
                  const better = c.avgReturnHigh > c.avgReturnLow;
                  return (
                    <tr key={c.score} className="border-b border-border text-cell hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1 text-text-primary font-semibold">{c.score}</td>
                      <td className={`px-3 py-1 text-right tabular-nums ${better ? "text-signal-green" : "text-text-secondary"}`}>
                        {c.avgReturnHigh >= 0 ? "+" : ""}{c.avgReturnHigh}%
                      </td>
                      <td className={`px-3 py-1 text-right tabular-nums ${!better ? "text-signal-red" : "text-text-secondary"}`}>
                        {c.avgReturnLow >= 0 ? "+" : ""}{c.avgReturnLow}%
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums">{c.winRateHigh}%</td>
                      <td className="px-3 py-1 text-right tabular-nums">{c.winRateLow}%</td>
                      <td className="px-3 py-1 text-right tabular-nums text-text-muted">
                        {c.signalCountHigh}/{c.signalCountLow}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Open trade detail */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-body text-text-secondary mb-2">Open Positions</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-row text-label text-text-secondary">
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Scores</th>
                <th className="px-3 py-2 text-right">Entry</th>
                <th className="px-3 py-2 text-right">Current</th>
                <th className="px-3 py-2 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const current = prices.get(t.symbol) ?? t.entryPrice;
                const pct = ((current - t.entryPrice) / t.entryPrice) * 100;
                const date = new Date(t.timestamp).toLocaleDateString();
                return (
                  <tr key={t.id} className="border-b border-border text-cell">
                    <td className="px-3 py-1 text-text-primary font-semibold">
                      {t.symbol.replace("USDT", "")}
                      <span className="text-text-muted text-label ml-1">{date}</span>
                    </td>
                    <td className="px-3 py-1 text-text-secondary tabular-nums">
                      M:{t.momentumSnapshot} SM:{t.smartMoneySnapshot} ST:{t.structureSnapshot} C:{t.consensusSnapshot}
                    </td>
                    <td className="px-3 py-1 text-text-secondary text-right tabular-nums">
                      ${t.entryPrice.toFixed(6)}
                    </td>
                    <td className="px-3 py-1 text-text-primary text-right tabular-nums">
                      ${current.toFixed(6)}
                    </td>
                    <td className={`px-3 py-1 text-right tabular-nums font-semibold ${pct >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                      {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CumulativePnlChart({ data }: { data: { time: number; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const dataKey = JSON.stringify(data.map((d) => [d.time, d.value.toFixed(2)]));

  useEffect(() => {
    if (!ref.current || !data.length) return;

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
      height: 200,
      crosshair: { mode: 0 },
      rightPriceScale: { visible: true },
      timeScale: { visible: true },
    });

    const line = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
    });

    const chartData = data.map((d) => ({
      time: (d.time / 1000) as any,
      value: d.value,
    }));

    line.setData(chartData);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [dataKey]);

  if (!data.length) return null;
  return (
    <div>
      <span className="text-label text-text-muted block mb-1">Cumulative P&L</span>
      <div ref={ref} className="w-full rounded border border-border" />
    </div>
  );
}
