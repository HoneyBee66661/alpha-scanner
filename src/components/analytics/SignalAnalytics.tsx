import { useMemo } from "react";
import type { PaperTrade } from "../../types";

interface Props {
  trades: PaperTrade[];
  prices: Map<string, number>;
}

interface Analytics {
  winRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  signalCount: number;
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

function compute(trades: PaperTrade[], prices: Map<string, number>): Analytics {
  if (!trades.length) return { winRate: 0, avgReturn: 0, bestReturn: 0, worstReturn: 0, signalCount: 0 };
  const returns: number[] = [];
  for (const t of trades) {
    const current = prices.get(t.symbol) ?? t.entryPrice;
    const pct = ((current - t.entryPrice) / t.entryPrice) * 100;
    returns.push(pct);
  }
  const wins = returns.filter((r) => r > 0).length;
  return {
    winRate: Math.round((wins / returns.length) * 100),
    avgReturn: parseFloat((returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2)),
    bestReturn: parseFloat(Math.max(...returns).toFixed(2)),
    worstReturn: parseFloat(Math.min(...returns).toFixed(2)),
    signalCount: trades.length,
  };
}

function computeCorrelations(trades: PaperTrade[], prices: Map<string, number>): ScoreCorrelation[] {
  if (trades.length < 4) return [];

  const scores = [
    { key: "alphaSnapshot" as const, label: "Alpha" },
    { key: "smartMoneySnapshot" as const, label: "Smart Money" },
    { key: "swingSnapshot" as const, label: "Swing" },
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

    const avgHigh = high.length > 0 ? parseFloat((high.reduce((s, w) => s + w.pct, 0) / high.length).toFixed(2)) : 0;
    const avgLow = low.length > 0 ? parseFloat((low.reduce((s, w) => s + w.pct, 0) / low.length).toFixed(2)) : 0;
    const winsHigh = high.filter((w) => w.pct > 0).length;
    const winsLow = low.filter((w) => w.pct > 0).length;

    return {
      score: label,
      avgReturnHigh: avgHigh,
      avgReturnLow: avgLow,
      winRateHigh: high.length > 0 ? Math.round((winsHigh / high.length) * 100) : 0,
      winRateLow: low.length > 0 ? Math.round((winsLow / low.length) * 100) : 0,
      signalCountHigh: high.length,
      signalCountLow: low.length,
    };
  });
}

function statCard(label: string, value: string | number, accent?: string) {
  return (
    <div className="card flex flex-col gap-1 min-w-[140px]">
      <span className="text-label text-text-muted">{label}</span>
      <span className={`text-heading tabular-nums ${accent ?? "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

export default function SignalAnalytics({ trades, prices }: Props) {
  const stats = useMemo(() => compute(trades, prices), [trades, prices]);
  const correlations = useMemo(() => computeCorrelations(trades, prices), [trades, prices]);

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-auto scroll-thin">
      <div>
        <h2 className="text-heading text-text-primary mb-1">Signal Analytics</h2>
        <p className="text-body text-text-muted">Evaluate signal effectiveness from paper trades.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {statCard("Win Rate", `${stats.winRate}%`, stats.winRate >= 50 ? "text-signal-green" : "text-signal-red")}
        {statCard("Avg Return", `${stats.avgReturn}%`, stats.avgReturn >= 0 ? "text-signal-green" : "text-signal-red")}
        {statCard("Best Return", `${stats.bestReturn}%`, "text-signal-green")}
        {statCard("Worst Return", `${stats.worstReturn}%`, "text-signal-red")}
        {statCard("Signals", stats.signalCount)}
      </div>

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

      {trades.length > 0 && (
        <div className="mt-4">
          <h3 className="text-body text-text-secondary mb-2">Trade Detail</h3>
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
                      A:{t.alphaSnapshot} SM:{t.smartMoneySnapshot} SW:{t.swingSnapshot} C:{t.consensusSnapshot}
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
