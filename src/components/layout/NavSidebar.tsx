import type { ScannerView } from "../../types";

function NavIcon({ d, viewBox }: { d: string; viewBox?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox={viewBox ?? "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const navItems: { id: ScannerView; label: string; icon: React.ReactNode }[] = [
  {
    id: "scanner",
    label: "Scanner",
    icon: (
      <NavIcon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    ),
  },
  {
    id: "buy-recs",
    label: "Buy Recs",
    icon: (
      <NavIcon d="M12 2l3 6h6l-5 4 2 6-6-4-6 4 2-6-5-4h6z" />
    ),
  },
  {
    id: "sell-recs",
    label: "Sell Recs",
    icon: (
      <NavIcon d="M3 6l3 3-3 3 M9 12h12 M3 18h12" />
    ),
  },
  {
    id: "watchlist",
    label: "Watchlist",
    icon: (
      <NavIcon d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" />
    ),
  },
  {
    id: "smart-money",
    label: "Smart Money",
    icon: (
      <NavIcon d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H6" />
    ),
  },
  {
    id: "accumulation",
    label: "Accumulation",
    icon: (
      <NavIcon d="M22 12h-4l-3 9L9 3l-3 9H2" />
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <NavIcon d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <NavIcon d="M18 20V10M12 20V4M6 20v-6" />
    ),
  },
  {
    id: "ai-benchmark",
    label: "AI Benchmark",
    icon: (
      <NavIcon d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z M9 8l6 4-6 4V8z" />
    ),
  },
  {
    id: "signal-log",
    label: "Signal Log",
    icon: (
      <NavIcon d="M18.36 6.64a9 9 0 1 1-12.72 0M12 2v6" />
    ),
  },
  {
    id: "backtest",
    label: "Backtest",
    icon: (
      <NavIcon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2" />
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <NavIcon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <NavIcon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    ),
  },
];

interface Props {
  view: ScannerView;
  collapsed: boolean;
  onViewChange: (v: ScannerView) => void;
  onToggleCollapse: () => void;
  openTradeCount?: number;
  watchlistCount?: number;
}

export default function NavSidebar({ view, collapsed, onViewChange, onToggleCollapse, openTradeCount, watchlistCount }: Props) {
  return (
    <nav
      className={`flex flex-col border-r border-border bg-surface-card transition-all duration-200 ${
        collapsed ? "w-[52px]" : "w-[210px]"
      }`}
    >
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        {!collapsed && (
          <span className="text-brand text-text-primary">
            <span className="text-signal-blue">A</span>SCAN
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-white/5 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">" : "<"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex w-full items-center gap-3 px-3 py-2.5 text-body transition-colors ${
              view === item.id
                ? "bg-white/8 text-text-primary border-l-2 border-signal-blue"
                : "text-text-secondary hover:bg-white/5 border-l-2 border-transparent"
            }`}
            title={item.label}
          >
{/* Icon */}
            <span className="flex h-7 w-7 items-center justify-center rounded bg-surface-row text-label font-bold shrink-0 relative">
              {item.icon}
              {item.id === "portfolio" && openTradeCount && openTradeCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-signal-red" />
              ) : null}
              {item.id === "watchlist" && watchlistCount && watchlistCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-signal-yellow" />
              ) : null}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.id === "portfolio" && openTradeCount && openTradeCount > 0 ? (
              <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-signal-red text-[10px] font-bold text-white px-1">
                {openTradeCount}
              </span>
            ) : null}
            {!collapsed && item.id === "watchlist" && watchlistCount && watchlistCount > 0 ? (
              <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-signal-yellow text-[10px] font-bold text-white px-1">
                {watchlistCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="border-t border-border px-3 py-2">
        {!collapsed && (
          <p className="text-label text-text-muted">v1.0 · Free tier</p>
        )}
      </div>
    </nav>
  );
}
