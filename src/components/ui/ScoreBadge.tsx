import type { Scores } from "../../types";

interface BadgeProps {
  value: number;
  label: string;
  threshold?: { high: number; mid: number };
}

function scoreColor(value: number, threshold?: { high: number; mid: number }) {
  const hi = threshold?.high ?? 80;
  const md = threshold?.mid ?? 65;
  if (value >= hi) return "badge-green";
  if (value >= md) return "badge-yellow";
  return "badge-red";
}

export default function ScoreBadge({ value, label, threshold }: BadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-cell text-text-muted">{label}</span>
      <span className={scoreColor(value, threshold)}>{value}</span>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "badge-green"
      : score >= 65
        ? "badge-yellow"
        : "badge-red";
  return <span className={cls}>{score}</span>;
}

export function ConsensusPill({ value }: { value: number }) {
  return (
    <span
      className={
        value >= 85
          ? "badge-green"
          : value >= 70
            ? "badge-yellow"
            : "badge-red"
      }
    >
      {value}
    </span>
  );
}

export function AllScores({ scores }: { scores: Scores }) {
  return (
    <div className="flex items-center gap-3 text-mono">
      <ScoreBadge label="A" value={scores.alpha} threshold={{ high: 80, mid: 60 }} />
      <ScoreBadge label="SM" value={scores.smartMoney} threshold={{ high: 75, mid: 55 }} />
      <ScoreBadge label="SW" value={scores.swing} threshold={{ high: 70, mid: 50 }} />
      <ScoreBadge label="AC" value={scores.accumulation} threshold={{ high: 70, mid: 50 }} />
      <span className="text-cell text-text-muted font-semibold">C:</span>
      <ConsensusPill value={scores.consensus} />
    </div>
  );
}
