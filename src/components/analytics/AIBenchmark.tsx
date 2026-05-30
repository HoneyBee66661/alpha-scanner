import { useMemo } from "react";
import type { ClosedTrade, PaperTrade } from "../../types";
import { computeBenchmark, computeScoreAccuracy, compareMetric } from "../../lib/aiAnalytics";

interface Props {
  trades: PaperTrade[];
  closedTrades: ClosedTrade[];
  rulesBalance: number;
  aiBalance: number;
}

function MetricCard({
  label,
  aiVal,
  rulesVal,
  format,
  higherIsBetter,
}: {
  label: string;
  aiVal: string;
  rulesVal: string;
  format?: "dollar" | "pct" | "count" | "raw";
  higherIsBetter?: boolean;
}) {
  const winner = compareMetric(
    parseFloat(aiVal.replace(/[^0-9.-]/g, "")),
    parseFloat(rulesVal.replace(/[^0-9.-]/g, "")),
    higherIsBetter ?? true
  );

  return (
    <div className="bg-white/5 rounded p-3 border border-white/5">
      <div className="text-label text-text-muted mb-2">{label}</div>
      <div className="flex gap-4">
        <div className={`flex-1 ${winner === "ai" ? "text-signal-green" : "text-text-secondary"}`}>
          <div className="text-caption text-text-muted">AI</div>
          <div className="text-value font-mono">{aiVal}</div>
        </div>
        <div className={`flex-1 ${winner === "rules" ? "text-signal-green" : "text-text-secondary"}`}>
          <div className="text-caption text-text-muted">Rules</div>
          <div className="text-value font-mono">{rulesVal}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreAccuracyTable({ closedTrades, trader }: { closedTrades: ClosedTrade[]; trader: "ai" | "rules" }) {
  const accuracies = useMemo(() => computeScoreAccuracy(closedTrades, trader), [closedTrades, trader]);
  if (accuracies.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="text-label text-text-muted mb-2">
        Score Predictive Power — {trader === "ai" ? "AI" : "Rules"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-caption">
          <thead>
            <tr className="text-text-muted border-b border-white/10">
              <th className="text-left py-1 pr-2">Model</th>
              <th className="text-right py-1 px-2">Avg Entry</th>
              <th className="text-right py-1 px-2">Win &gt;Median</th>
              <th className="text-right py-1 px-2">Win &lt;Median</th>
              <th className="text-right py-1 pl-2">Spread</th>
            </tr>
          </thead>
          <tbody>
            {accuracies.map((a) => (
              <tr key={a.model} className="border-b border-white/5">
                <td className="py-1 pr-2 text-text-secondary">{a.model}</td>
                <td className="py-1 px-2 text-right font-mono">{a.avgEntryScore}</td>
                <td className="py-1 px-2 text-right font-mono text-signal-green">{a.winRateAboveMedian}%</td>
                <td className="py-1 px-2 text-right font-mono text-signal-red">{a.winRateBelowMedian}%</td>
                <td className={`py-1 pl-2 text-right font-mono ${a.correlation > 0 ? "text-signal-green" : "text-signal-red"}`}>
                  {a.correlation > 0 ? "+" : ""}{a.correlation}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AIBenchmark({ trades, closedTrades, rulesBalance, aiBalance }: Props) {
  const benchmark = useMemo(() => computeBenchmark(closedTrades), [closedTrades]);

  const aiTrades = trades.filter((t) => t.trader === "ai");
  const rulesTrades = trades.filter((t) => t.trader === "rules");

  const aiClosed = closedTrades.filter((t) => t.trader === "ai");
  const rulesClosed = closedTrades.filter((t) => t.trader === "rules");

  if (aiClosed.length === 0 && rulesClosed.length === 0) {
    return (
      <div className="p-6 text-center text-text-muted">
        <p className="text-lg mb-2">No trade history yet</p>
        <p className="text-caption">
          The AI and Rules traders will populate data as they execute trades.
          <br />
          AI runs every 15 min via cron; Rules runs every 5 min.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI vs Rules Benchmark</h2>
        <div className="flex gap-3 text-caption text-text-muted">
          <span>AI closed: {aiClosed.length}</span>
          <span>Rules closed: {rulesClosed.length}</span>
        </div>
      </div>

      {/* Active positions summary */}
      <div className="flex gap-4 text-caption">
        <div className="bg-white/5 rounded px-3 py-2">
          <span className="text-text-muted">AI Active: </span>
          <span className="font-mono">{aiTrades.length}</span>
          <span className="text-text-muted ml-2">Balance: </span>
          <span className="font-mono">${aiBalance.toFixed(2)}</span>
        </div>
        <div className="bg-white/5 rounded px-3 py-2">
          <span className="text-text-muted">Rules Active: </span>
          <span className="font-mono">{rulesTrades.length}</span>
          <span className="text-text-muted ml-2">Balance: </span>
          <span className="font-mono">${rulesBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Total P&L"
          aiVal={`$${benchmark.ai?.totalNetPnl.toFixed(2) ?? "0.00"}`}
          rulesVal={`$${benchmark.rules?.totalNetPnl.toFixed(2) ?? "0.00"}`}
          higherIsBetter
        />
        <MetricCard
          label="Win Rate"
          aiVal={`${benchmark.ai?.winRate ?? 0}%`}
          rulesVal={`${benchmark.rules?.winRate ?? 0}%`}
          higherIsBetter
        />
        <MetricCard
          label="Total Trades"
          aiVal={`${benchmark.ai?.totalTrades ?? 0}`}
          rulesVal={`${benchmark.rules?.totalTrades ?? 0}`}
          higherIsBetter
        />
        <MetricCard
          label="Avg Return/Trade"
          aiVal={`${benchmark.ai?.expectancy.toFixed(2) ?? "0.00"}`}
          rulesVal={`${benchmark.rules?.expectancy.toFixed(2) ?? "0.00"}`}
          higherIsBetter
        />
        <MetricCard
          label="Sharpe Ratio"
          aiVal={benchmark.ai?.sharpeRatio.toFixed(2) ?? "0.00"}
          rulesVal={benchmark.rules?.sharpeRatio.toFixed(2) ?? "0.00"}
          higherIsBetter
        />
        <MetricCard
          label="Max Drawdown"
          aiVal={`$${benchmark.ai?.maxDrawdown.toFixed(2) ?? "0.00"}`}
          rulesVal={`$${benchmark.rules?.maxDrawdown.toFixed(2) ?? "0.00"}`}
          higherIsBetter={false}
        />
        <MetricCard
          label="Profit Factor"
          aiVal={benchmark.ai?.profitFactor === Infinity ? "∞" : (benchmark.ai?.profitFactor.toFixed(2) ?? "0.00")}
          rulesVal={benchmark.rules?.profitFactor === Infinity ? "∞" : (benchmark.rules?.profitFactor.toFixed(2) ?? "0.00")}
          higherIsBetter
        />
        <MetricCard
          label="Best Return"
          aiVal={`${benchmark.ai?.bestReturn.toFixed(1) ?? "0"}%`}
          rulesVal={`${benchmark.rules?.bestReturn.toFixed(1) ?? "0"}%`}
          higherIsBetter
        />
        <MetricCard
          label="Worst Return"
          aiVal={`${benchmark.ai?.worstReturn.toFixed(1) ?? "0"}%`}
          rulesVal={`${benchmark.rules?.worstReturn.toFixed(1) ?? "0"}%`}
          higherIsBetter={false}
        />
      </div>

      {/* Score accuracy analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreAccuracyTable closedTrades={closedTrades} trader="ai" />
        <ScoreAccuracyTable closedTrades={closedTrades} trader="rules" />
      </div>
    </div>
  );
}
