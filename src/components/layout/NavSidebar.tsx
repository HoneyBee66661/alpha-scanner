import type { ScannerView } from "../../types";

const navItems: { id: ScannerView; label: string; icon: string }[] = [
  { id: "scanner", label: "Scanner", icon: "=" },
  { id: "buy-recs", label: "Buy Recs", icon: "$" },
  { id: "watchlist", label: "Watchlist", icon: "*" },
  { id: "smart-money", label: "Smart Money", icon: "S" },
  { id: "accumulation", label: "Accumulation", icon: "A" },
  { id: "portfolio", label: "Portfolio", icon: "P" },
  { id: "analytics", label: "Analytics", icon: "%" },
  { id: "signal-log", label: "Signal Log", icon: "~" },
  { id: "backtest", label: "Backtest", icon: "B" },
  { id: "settings", label: "Settings", icon: "*" },
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
