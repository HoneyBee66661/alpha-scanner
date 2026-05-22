import { useState } from "react";
import type { SignalLogEntry } from "../../lib/signalLog";

interface Props {
  entries: SignalLogEntry[];
}

const EVENT_COLORS: Record<string, string> = {
  "BUY": "text-signal-green bg-signal-greenBg",
  "SELL": "text-signal-red bg-signal-redBg",
  "REMOVE": "text-signal-red bg-signal-redBg",
  "SIGNAL": "text-signal-yellow bg-signal-yellowBg",
  "SCAN": "text-signal-blue bg-signal-blueBg",
};

function eventBadge(event: string): string {
  const key = Object.keys(EVENT_COLORS).find((k) => event.toUpperCase().includes(k));
  return EVENT_COLORS[key ?? ""] ?? "text-text-muted bg-surface-row";
}

export default function SignalLogViewer({ entries }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? entries.filter(
        (e) =>
          e.symbol.toLowerCase().includes(filter.toLowerCase()) ||
          e.event.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  const eventTypes = [...new Set(entries.map((e) => e.event))];

  if (!entries.length) {
    return (
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-body text-text-secondary">No signal history yet.</p>
        <span className="text-label text-text-muted mt-1">Buy/sell activity will appear here.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Signal History</span>
        <span className="text-label text-text-muted">{entries.length} events</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <input
          className="w-full max-w-xs rounded border border-border bg-surface-input px-3 py-1.5 text-cell text-text-primary placeholder:text-text-muted focus:border-border-focus outline-none"
          placeholder="Filter by symbol or event..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {eventTypes.slice(0, 5).map((ev) => (
          <button
            key={ev}
            onClick={() => setFilter(filter === ev ? "" : ev)}
            className={`px-2 py-0.5 rounded text-label border transition-colors ${
              filter === ev ? "border-signal-blue text-signal-blue" : "border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {ev}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 z-10 bg-surface-row text-label text-text-secondary">
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-left">Event</th>
              <th className="px-3 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, i) => (
              <tr
                key={entry.id ?? i}
                className="border-b border-border hover:bg-surface-hover transition-colors h-10 text-cell"
              >
                <td className="px-3 py-1 text-text-muted tabular-nums text-label">
                  {formatTime(entry.timestamp)}
                </td>
                <td className="px-3 py-1 text-text-primary font-semibold tabular-nums">
                  {entry.symbol.replace("USDT", "")}
                </td>
                <td className="px-3 py-1">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-label font-semibold ${eventBadge(entry.event)}`}>
                    {entry.event}
                  </span>
                </td>
                <td className="px-3 py-1 text-label text-text-muted max-w-[300px] truncate" title={entry.details}>
                  {entry.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
