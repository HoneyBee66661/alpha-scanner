import type { TokenRow } from "../../types";
import { getTopBuyRecommendations, buyActionColor, buyActionBg, buyActionLabel } from "../../lib/buyRecommendation";

interface Props {
  tokens: TokenRow[];
  loading: boolean;
  onBuy?: (symbol: string) => void;
  onTokenClick?: (symbol: string) => void;
  onBacktest?: (symbol: string) => void;
}

export default function BuyRecommendations({ tokens, loading, onBuy, onTokenClick, onBacktest }: Props) {
  const recs = getTopBuyRecommendations(tokens);

  if (!loading && tokens.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary mb-4">
          No market data available. Try refreshing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Buy Recommendations</span>
        <span className="text-label text-text-muted">
          Top picks ranked by composite score
        </span>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {loading && tokens.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-body">
            <span className="inline-block w-2 h-2 rounded-full bg-signal-yellow animate-pulse mr-2" />
            Scanning markets...
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
                <th className="w-10 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Cons</th>
                <th className="px-3 py-2 text-right">Momentum</th>
                <th className="px-3 py-2 text-right">Smart $</th>
                <th className="px-3 py-2 text-right">Accum</th>
                <th className="px-3 py-2 text-right">24h %</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-center">Signal</th>
                <th className="px-3 py-2 text-left max-w-[200px]">Reason</th>
                {(onBuy || onBacktest) && <th className="px-3 py-2 text-center w-20">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {recs.map((rec, i) => (
                <tr
                  key={rec.symbol}
                  className="border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell"
                >
                  <td className="px-3 py-1 text-text-muted tabular-nums">{i + 1}</td>
                  <td
                    className="px-3 py-1 text-text-primary font-semibold tabular-nums cursor-pointer hover:text-signal-blue transition-colors"
                    onClick={() => onTokenClick?.(rec.symbol + "USDT")}
                  >
                    {rec.symbol}
                    <span className="text-text-muted font-normal">/USDT</span>
                  </td>
                  <td className="px-3 py-1 text-text-primary tabular-nums text-right">
                    {rec.price < 0.01 ? rec.price.toFixed(6) : rec.price.toFixed(4)}
                  </td>
                  <td className="px-3 py-1 tabular-nums text-right">
                    <ConsVal v={findScore(tokens, rec.symbol, "consensus")} />
                  </td>
                  <td className="px-3 py-1 tabular-nums text-right">
                    <ScoreVal v={findScore(tokens, rec.symbol, "momentum")} />
                  </td>
                  <td className="px-3 py-1 tabular-nums text-right">
                    <ScoreVal v={findScore(tokens, rec.symbol, "smartMoney")} />
                  </td>
                  <td className="px-3 py-1 tabular-nums text-right">
                    <ScoreVal v={findScore(tokens, rec.symbol, "accumulation")} />
                  </td>
                  <td className={`px-3 py-1 tabular-nums text-right ${
                    findPriceChange(tokens, rec.symbol) >= 0 ? "text-signal-green" : "text-signal-red"
                  }`}>
                    {formatPct(findPriceChange(tokens, rec.symbol))}
                  </td>
                  <td className="px-3 py-1 tabular-nums font-semibold text-right">
                    <ScoreVal v={rec.score} />
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold ${buyActionColor(rec.action)} ${buyActionBg(rec.action)}`}
                    >
                      {buyActionLabel(rec.action)}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-label text-text-muted max-w-[200px] truncate" title={rec.reason}>
                    {rec.reason}
                  </td>
                  {(onBuy || onBacktest) && (
                    <td className="px-3 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onBacktest && (
                          <button
                            onClick={() => onBacktest(rec.symbol + "USDT")}
                            className="px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-signal-blue hover:bg-white/5 transition-colors font-mono"
                            title="Instant backtest"
                          >
                            BT
                          </button>
                        )}
                        {onBuy && (
                          <button
                            onClick={() => onBuy(rec.symbol + "USDT")}
                            className="px-2 py-0.5 rounded text-label text-signal-green hover:bg-signal-greenBg transition-colors"
                            title="Paper buy at current price"
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function findScore(tokens: TokenRow[], symbol: string, field: keyof Pick<TokenRow, "momentum" | "smartMoney" | "accumulation" | "consensus">): number {
  return tokens.find((t) => t.symbol.startsWith(symbol))?.[field] ?? 0;
}

function findPriceChange(tokens: TokenRow[], symbol: string): number {
  return tokens.find((t) => t.symbol.startsWith(symbol))?.priceChange24h ?? 0;
}

function formatPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function ScoreVal({ v }: { v: number }) {
  const c =
    v >= 80
      ? "text-signal-green font-semibold"
      : v >= 65
        ? "text-signal-yellow font-semibold"
        : v >= 50
          ? "text-text-secondary"
          : "text-text-muted";
  return <span className={c}>{v}</span>;
}

function ConsVal({ v }: { v: number }) {
  return (
    <span
      className={
        v >= 85
          ? "inline-flex items-center rounded px-1.5 py-0.5 text-score bg-signal-greenBg text-signal-green"
          : v >= 70
            ? "inline-flex items-center rounded px-1.5 py-0.5 text-score bg-signal-yellowBg text-signal-yellow"
            : v >= 50
              ? "text-text-secondary font-semibold"
              : "text-text-muted"
      }
    >
      {v}
    </span>
  );
}
