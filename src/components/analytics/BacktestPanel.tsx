import { useMemo } from "react";
import type { TokenRow } from "../../types";
import { backtestAllModels, buildBacktestCandles, MODEL_LABELS } from "../../lib/backtest";
import type { BacktestResult, ScoreModel } from "../../lib/backtest";

interface Props {
  tokens: TokenRow[];
}

export default function BacktestPanel({ tokens }: Props) {
  const results = useMemo(() => {
    if (!tokens.length) return [];
    const candles = buildBacktestCandles(tokens);
    return backtestAllModels(candles);
  }, [tokens]);

  if (!tokens.length) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary">No data available for backtesting.</p>
        <p className="text-label text-text-muted mt-1">Load market data first to run backtests.</p>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary">Insufficient data for backtesting.</p>
        <p className="text-label text-text-muted mt-1">Need more candles per token for meaningful results.</p>
      </div>
    );
  }

  const bestOverall = results
    .flatMap((r) => r.thresholdResults)
    .sort((a, b) => b.winRate - a.winRate || b.avgReturn - a.avgReturn)[0];

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-auto scroll-thin">
      <div>
        <h2 className="text-heading text-text-primary mb-1">Backtesting Engine</h2>
        <p className="text-body text-text-muted">
          Optimize score thresholds by simulating trades on historical OHLCV data.
        </p>
      </div>

      {bestOverall && (
        <div className="flex flex-wrap gap-3">
          <div className="card flex flex-col gap-1 min-w-[140px]">
            <span className="text-label text-text-muted">Best Model</span>
            <span className="text-heading text-signal-blue tabular-nums">
              {MODEL_LABELS[results.find((r) =>
                r.thresholdResults.some((t) => t === bestOverall)
              )?.model ?? "momentum"]}
            </span>
          </div>
          <div className="card flex flex-col gap-1 min-w-[140px]">
            <span className="text-label text-text-muted">Best Threshold</span>
            <span className="text-heading text-text-primary tabular-nums">{bestOverall.threshold}</span>
          </div>
          <div className="card flex flex-col gap-1 min-w-[140px]">
            <span className="text-label text-text-muted">Win Rate</span>
            <span className={`text-heading tabular-nums ${bestOverall.winRate >= 50 ? "text-signal-green" : "text-signal-red"}`}>
              {bestOverall.winRate}%
            </span>
          </div>
          <div className="card flex flex-col gap-1 min-w-[140px]">
            <span className="text-label text-text-muted">Avg Return</span>
            <span className={`text-heading tabular-nums ${bestOverall.avgReturn >= 0 ? "text-signal-green" : "text-signal-red"}`}>
              {bestOverall.avgReturn}%
            </span>
          </div>
        </div>
      )}

      {results.map((modelResult) => (
        <div key={modelResult.model} className="card">
          <h3 className="text-body text-text-primary font-semibold mb-3">
            {MODEL_LABELS[modelResult.model]} Score
            <span className="text-label text-text-muted ml-2">
              {modelResult.totalCandles} candles analyzed
            </span>
          </h3>
          <div className="overflow-auto scroll-thin">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-row text-label text-text-secondary">
                  <th className="px-3 py-2 text-left">Threshold</th>
                  <th className="px-3 py-2 text-right">Trades</th>
                  <th className="px-3 py-2 text-right">Win Rate</th>
                  <th className="px-3 py-2 text-right">Avg Return</th>
                  <th className="px-3 py-2 text-right">Best</th>
                  <th className="px-3 py-2 text-right">Worst</th>
                </tr>
              </thead>
              <tbody>
                {modelResult.thresholdResults.map((t) => (
                  <tr
                    key={t.threshold}
                    className={`border-b border-border text-cell hover:bg-surface-hover transition-colors ${
                      t.winRate >= 60 ? "bg-signal-greenBg/20" : ""
                    }`}
                  >
                    <td className="px-3 py-1 text-text-primary tabular-nums">* {t.threshold}</td>
                    <td className="px-3 py-1 text-text-secondary text-right tabular-nums">{t.trades}</td>
                    <td className={`px-3 py-1 text-right tabular-nums font-semibold ${t.winRate >= 50 ? "text-signal-green" : "text-signal-red"}`}>
                      {t.winRate}%
                    </td>
                    <td className={`px-3 py-1 text-right tabular-nums ${t.avgReturn >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                      {t.avgReturn >= 0 ? "+" : ""}{t.avgReturn}%
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-signal-green">+{t.bestReturn}%</td>
                    <td className="px-3 py-1 text-right tabular-nums text-signal-red">{t.worstReturn}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className="text-label text-text-muted mt-2">
        Backtest runs on available OHLCV data and held-for-duration simulations.
        Results are indicative — past patterns don't guarantee future performance.
      </p>
    </div>
  );
}
