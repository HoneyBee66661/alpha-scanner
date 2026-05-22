import { useState, useMemo } from "react";
import type { TokenRow, SortColumn, SortDirection } from "../../types";
import { AllScores } from "../ui/ScoreBadge";
import SignalTags from "../ui/SignalTag";

interface Props {
  tokens: TokenRow[];
  loading: boolean;
  error?: string | null;
  highlightScore?: "alpha" | "smartMoney" | "swing" | "accumulation" | "consensus";
  onBuy?: (symbol: string) => void;
}

export default function ScannerTable({ tokens, loading, highlightScore, onBuy }: Props) {
  const [sort, setSort] = useState<SortColumn>("consensus");
  const [dir, setDir] = useState<SortDirection>("desc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const list = tokens
      .filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        let va: number;
        let vb: number;
        if (sort === "symbol") {
          return dir === "asc"
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        }
        switch (sort) {
          case "price": va = a.price; vb = b.price; break;
          case "alpha": va = a.alpha; vb = b.alpha; break;
          case "smartMoney": va = a.smartMoney; vb = b.smartMoney; break;
          case "swing": va = a.swing; vb = b.swing; break;
          case "accumulation": va = a.accumulation; vb = b.accumulation; break;
          case "consensus": va = a.consensus; vb = b.consensus; break;
          case "volume24h": va = a.volume24h; vb = b.volume24h; break;
          case "priceChange24h": va = a.priceChange24h; vb = b.priceChange24h; break;
          default: return 0;
        }
        return dir === "asc" ? va - vb : vb - va;
      });
    return list;
  }, [tokens, sort, dir, search]);

  function toggle(col: SortColumn) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("desc");
    }
  }

  function sortIndicator(col: SortColumn) {
    if (sort !== col) return " ";
    return dir === "asc" ? " ↑" : " ↓";
  }

  const cols: { key: SortColumn; label: string }[] = [
    { key: "symbol", label: "Pair" },
    { key: "price", label: "Price" },
    { key: "alpha", label: "Alpha" },
    { key: "smartMoney", label: "Smart $" },
    { key: "swing", label: "Swing" },
    { key: "accumulation", label: "Accum" },
    { key: "consensus", label: "Cons" },
    { key: "volume24h", label: "Vol 24h" },
    { key: "priceChange24h", label: "24h %" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <div className="relative flex-1 max-w-xs">
          <input
            className="w-full rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary placeholder:text-text-muted focus:border-border-focus outline-none"
            placeholder="Search pairs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-label text-text-muted tabular-nums">
          {sorted.length} tokens
        </span>
      </div>

      <div className="flex-1 overflow-auto scroll-thin">
        {loading && tokens.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-body">
            <span className="inline-block w-2 h-2 rounded-full bg-signal-yellow animate-pulse mr-2" />
            Loading market data...
          </div>
        ) : tokens.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-body flex-col gap-2">
            <span>No data available</span>
            <span className="text-label">Try refreshing or check your connection</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
                <th className="w-10 px-3 py-2 text-left">#</th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    className={`px-3 py-2 text-left cursor-pointer select-none hover:text-text-primary transition-colors ${
                      c.key === highlightScore
                        ? "text-signal-blue"
                        : ""
                    }`}
                  >
                    {c.label}
                    <span className="text-text-muted text-[10px]">
                      {sortIndicator(c.key)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-left">Tags</th>
                {onBuy && <th className="px-3 py-2 text-center w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((token, i) => (
                <tr
                  key={token.symbol}
                  className="border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell"
                >
                  <td className="px-3 py-1 text-text-muted tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-1 text-text-primary font-semibold tabular-nums">
                    {token.symbol.replace("USDT", "")}
                    <span className="text-text-muted font-normal">/USDT</span>
                  </td>
                  <td className="px-3 py-1 text-text-primary tabular-nums">
                    {token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(4)}
                  </td>
                  <td className={`px-3 py-1 tabular-nums ${highlightScore === "alpha" ? "text-signal-yellow" : ""}`}>
                    <ScoreVal v={token.alpha} />
                  </td>
                  <td className={`px-3 py-1 tabular-nums ${highlightScore === "smartMoney" ? "text-signal-yellow" : ""}`}>
                    <ScoreVal v={token.smartMoney} />
                  </td>
                  <td className={`px-3 py-1 tabular-nums ${highlightScore === "swing" ? "text-signal-yellow" : ""}`}>
                    <ScoreVal v={token.swing} />
                  </td>
                  <td className={`px-3 py-1 tabular-nums ${highlightScore === "accumulation" ? "text-signal-yellow" : ""}`}>
                    <ScoreVal v={token.accumulation} />
                  </td>
                  <td className={`px-3 py-1 tabular-nums ${highlightScore === "consensus" ? "text-signal-yellow" : ""}`}>
                    <ConsVal v={token.consensus} />
                  </td>
                  <td className="px-3 py-1 text-text-secondary tabular-nums">
                    {formatVol(token.volume24h)}
                  </td>
                  <td
                    className={`px-3 py-1 tabular-nums ${
                      token.priceChange24h >= 0 ? "text-signal-green" : "text-signal-red"
                    }`}
                  >
                    {token.priceChange24h >= 0 ? "+" : ""}
                    {token.priceChange24h.toFixed(2)}%
                  </td>
                  <td className="px-3 py-1">
                    <SignalTags tags={token.tags} />
                  </td>
                  {onBuy && (
                    <td className="px-3 py-1 text-center">
                      <button
                        onClick={() => onBuy(token.symbol)}
                        className="px-2 py-0.5 rounded text-label text-signal-green hover:bg-signal-greenBg transition-colors"
                        title="Simulate paper buy at current price"
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

function formatVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
