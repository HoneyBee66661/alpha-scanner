interface StatProps {
  stats: { label: string; value: string }[];
}

export default function TopBar({ stats }: StatProps) {
  return (
    <div className="flex items-center gap-6 border-b border-border bg-surface-card px-4 py-2 text-label">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="text-text-muted">{s.label}:</span>
          <span className="text-text-primary font-semibold tabular-nums">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
