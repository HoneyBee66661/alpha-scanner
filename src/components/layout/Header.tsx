import { useEffect, useState, type ReactNode } from "react";

interface Props {
  loading: boolean;
  lastRefresh: number | null;
  onRefresh: () => void;
  children?: ReactNode;
}

export default function Header({ loading, lastRefresh, onRefresh, children }: Props) {
  const [timeAgo, setTimeAgo] = useState("--");

  useEffect(() => {
    function update() {
      if (!lastRefresh) {
        setTimeAgo("--");
        return;
      }
      const diff = Math.floor((Date.now() - lastRefresh) / 1000);
      setTimeAgo(diff < 60 ? `${diff}s ago` : `${Math.floor(diff / 60)}m ago`);
    }
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastRefresh]);

  return (
    <header className="flex items-center gap-4 border-b border-border bg-surface-card px-4 h-12 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-brand text-text-primary select-none">
          <span className="text-signal-blue font-bold">A</span>
          <span className="text-text-secondary font-semibold">LPHA </span>
          <span className="font-semibold">SCANNER</span>
        </span>
        {children && <div className="flex items-center">{children}</div>}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 text-label text-text-muted">
        <span className={loading ? "opacity-100" : "opacity-0"}>
          <span className="inline-block w-2 h-2 rounded-full bg-signal-yellow animate-pulse" />
          {" "}refreshing
        </span>
        {!loading && lastRefresh && (
          <span>updated {timeAgo}</span>
        )}
      </div>

      <button onClick={onRefresh} className="btn-ghost h-8 px-3" disabled={loading}>
        {loading ? "..." : "↻ Refresh"}
      </button>
    </header>
  );
}
