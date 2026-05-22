import type { TokenRow } from "../../types";
import { AllScores } from "../ui/ScoreBadge";
import SignalTags from "../ui/SignalTag";

interface Props {
  tokens: TokenRow[];
  watchlist: string[];
  loading: boolean;
  onBuy?: (symbol: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
}

export default function WatchlistPanel({ tokens, watchlist, loading, onBuy, onRemoveFromWatchlist }: Props) {
  const watched = tokens.filter((t) => watchlist.includes(t.symbol));

  if (!loading && watchlist.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary mb-4">
          Your watchlist is empty.
        </p>
        <span className="text-label text-text-muted">
          Star tokens from the scanner to add them here.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Watchlist</span>
        <span className="text-label text-text-muted">
          {watchlist.length} tracked
        </span>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {loading && tokens.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-body">
            <span className="inline-block w-2 h-2 rounded-full bg-signal-yellow animate-pulse mr-2" />
            Loading...
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
                <th className="w-10 px-3 py-2 text-left"></th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Cons</th>
                <th className="px-3 py-2 text-right">Alpha</th>
                <th className="px-3 py-2 text-right">Smart $</th>
                <th className="px-3 py-2 text-right">Swing</th>
                <th className="px-3 py-2 text-right">Accum</th>
                <th className="px-3 py-2 text-right">24h %</th>
                <th className="px-3 py-2 text-left">Tags</th>
                {onBuy && <th className="px-3 py-2 text-center w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {watched.map((token, i) => (
                <tr
                  key={token.symbol}
                  className="border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell"
                >
                  <td className="px-3 py-1 text-center">
                    <button
                      onClick={() => onRemoveFromWatchlist(token.symbol)}
                      className="text-signal-yellow hover:text-signal-yellow/70 transition-colors text-label"
                      title="Remove from watchlist"
                    >
                      *
                    </button>
                  </td>
                  <td className="px-3 py-1 text-text-primary font-semibold tabular-nums">
                    {token.symbol.replace("USDT", "")}
                    <span className="text-text-muted font-normal">/USDT</span>
                  </td>
                  <td className="px-3 py-1 text-text-primary tabular-nums">
                    {token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(4)}
                  </td>
                  <td className="px-3 py-1 tabular-nums">
                    <ConsVal v={token.consensus} />
                  </td>
                  <td className="px-3 py-1 tabular-nums"><ScoreVal v={token.alpha} /></td>
                  <td className="px-3 py-1 tabular-nums"><ScoreVal v={token.smartMoney} /></td>
                  <td className="px-3 py-1 tabular-nums"><ScoreVal v={token.swing} /></td>
                  <td className="px-3 py-1 tabular-nums"><ScoreVal v={token.accumulation} /></td>
                  <td className={`px-3 py-1 tabular-nums ${token.priceChange24h >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                    {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1"><SignalTags tags={token.tags} /></td>
                  {onBuy && (
                    <td className="px-3 py-1 text-center">
                      <button
                        onClick={() => onBuy(token.symbol)}
                        className="px-2 py-0.5 rounded text-label text-signal-green hover:bg-signal-greenBg transition-colors"
                      >
                        Buy
                      </button>
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

function ScoreVal({ v }: { v: number }) {
  const c = v >= 80 ? "text-signal-green font-semibold" : v >= 65 ? "text-signal-yellow font-semibold" : v >= 50 ? "text-text-secondary" : "text-text-muted";
  return <span className={c}>{v}</span>;
}

function ConsVal({ v }: { v: number }) {
  return (
    <span className={
      v >= 85 ? "inline-flex items-center rounded px-1.5 py-0.5 text-score bg-signal-greenBg text-signal-green"
        : v >= 70 ? "inline-flex items-center rounded px-1.5 py-0.5 text-score bg-signal-yellowBg text-signal-yellow"
          : v >= 50 ? "text-text-secondary font-semibold" : "text-text-muted"
    }>
      {v}
    </span>
  );
}
