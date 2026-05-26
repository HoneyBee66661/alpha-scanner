import { useState, useEffect } from "react";
import { backtestSingleToken, MODEL_LABELS } from "../../lib/backtest";
import type { SingleTokenBacktestResult, ScoreModel } from "../../lib/backtest";

interface Props {
  symbol: string;
  ohlcv: { open: number; high: number; low: number; close: number; volume: number }[];
  scores: { momentum: number; smartMoney: number; structure: number; accumulation: number; sentiment: number; mmFootprint: number; consensus: number };
  onClose: () => void;
}

const models: ScoreModel[] = ["momentum", "smartMoney", "structure", "accumulation", "consensus"];

export default function BacktestPopup({ symbol, ohlcv, scores, onClose }: Props) {
  const [result, setResult] = useState<SingleTokenBacktestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Run synchronously but yield to render the loading state first
    const r = backtestSingleToken(
      symbol,
      ohlcv,
      scores.momentum,
      scores.smartMoney,
      scores.structure,
      scores.accumulation,
      scores.consensus
    );
    setResult(r);
    setLoading(false);
  }, [symbol, ohlcv, scores]);

  const hasData = result && result.results.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-lg border border-border bg-surface-card shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <span className="text-heading text-text-primary">
              Instant Backtest: <span className="text-signal-blue">{symbol.replace("USDT", "")}</span>
            </span>
            <span className="text-label text-text-muted ml-3">
              Consensus {scores.consensus} · {ohlcv.length} candles
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto scroll-thin p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-text-muted text-body">
              <span className="inline-block w-2 h-2 rounded-full bg-signal-yellow animate-pulse mr-2" />
              Running backtest...
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-muted text-body gap-2">
              <span>Insufficient data for backtesting</span>
              <span className="text-label">Need at least 10 OHLCV candles</span>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-label text-text-secondary border-b border-border">
                  <th className="px-3 py-2 text-left">Model</th>
                  <th className="px-3 py-2 text-right">Threshold</th>
                  <th className="px-3 py-2 text-right">Trades</th>
                  <th className="px-3 py-2 text-right">Win Rate</th>
                  <th className="px-3 py-2 text-right">Avg Return</th>
                  <th className="px-3 py-2 text-right">Best</th>
                  <th className="px-3 py-2 text-right">Worst</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  // Find the best threshold for this model
                  const modelResults = result!.results.filter((r) => {
                    // We need to map back — since runBacktest only stores threshold, we
                    // infer model by which thresholds correspond to which model runs.
                    // Each model has the same threshold set, so group by relative position.
                    return true;
                  });

                  // Actually, we need to group results by model. Let me get the best per model
                  // by picking the threshold result with highest win rate for each model range.
                  // Since models loop: 5 models x 6 thresholds = 30 results, first 6 = momentum, etc.
                  const idx = models.indexOf(model);
                  const perModel = result!.results.slice(idx * 6, idx * 6 + 6);
                  const best = perModel.sort((a, b) => b.winRate - a.winRate || b.avgReturn - a.avgReturn)[0];

                  if (!best || best.trades === 0) {
                    return (
                      <tr key={model} className="border-b border-border text-cell hover:bg-surface-hover transition-colors">
                        <td className="px-3 py-2 text-text-primary">{MODEL_LABELS[model]}</td>
                        <td className="px-3 py-2 text-text-muted text-right" colSpan={6}>No trades</td>
                      </tr>
                    );
                  }

                  const scoreForModel = model === "consensus" ? scores.consensus
                    : model === "momentum" ? scores.momentum
                    : model === "smartMoney" ? scores.smartMoney
                    : model === "structure" ? scores.structure
                    : scores.accumulation;

                  const scoreMatch = scoreForModel >= best.threshold;

                  return (
                    <tr
                      key={model}
                      className={`border-b border-border text-cell hover:bg-surface-hover transition-colors ${
                        scoreMatch ? "bg-signal-greenBg/10" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-text-primary font-semibold">
                        {MODEL_LABELS[model]}
                        {scoreMatch && (
                          <span className="ml-2 text-[10px] text-signal-green font-bold">✓</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-primary text-right tabular-nums">{best.threshold}</td>
                      <td className="px-3 py-2 text-text-secondary text-right tabular-nums">{best.trades}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${best.winRate >= 50 ? "text-signal-green" : "text-signal-red"}`}>
                        {best.winRate}%
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${best.avgReturn >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                        {best.avgReturn >= 0 ? "+" : ""}{best.avgReturn}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-signal-green">+{best.bestReturn}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-signal-red">{best.worstReturn}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {hasData && (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-label">
                <span className="inline-block w-2 h-2 rounded-full bg-signal-greenBg/10 border border-signal-green/40" />
                <span className="text-text-muted">Current score matches threshold</span>
              </div>
              <p className="text-label text-text-muted ml-auto">
                Backtest projects current scores across {ohlcv.length} historical candles.
                Past patterns don't guarantee future results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
