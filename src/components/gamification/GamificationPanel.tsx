import { useMemo } from "react";
import type { ClosedTrade } from "../../types";
import { computeGamification, computeLevel, getAllBadges } from "../../lib/gamification";
import type { GamificationState } from "../../lib/gamification";

interface Props {
  closedTrades: ClosedTrade[];
  gamification: GamificationState;
}

export default function GamificationPanel({ closedTrades, gamification }: Props) {
  const state = useMemo(
    () => computeGamification(closedTrades, gamification),
    [closedTrades, gamification]
  );

  const level = useMemo(() => computeLevel(state.xp), [state.xp]);
  const allBadges = useMemo(() => getAllBadges(), []);

  // Streaks
  const sorted = useMemo(
    () => [...closedTrades].sort((a, b) => a.exitTimestamp - b.exitTimestamp),
    [closedTrades]
  );

  let winStreak = 0;
  let lossStreak = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  for (const t of sorted) {
    if (t.netPnl > 0) {
      winStreak++;
      lossStreak = 0;
      if (winStreak > bestWinStreak) bestWinStreak = winStreak;
    } else {
      lossStreak++;
      winStreak = 0;
      if (lossStreak > worstLossStreak) worstLossStreak = lossStreak;
    }
  }

  const wonToday = closedTrades.some(
    (t) => t.netPnl > 0 && new Date(t.exitTimestamp).toDateString() === new Date().toDateString()
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-5 overflow-auto scroll-thin">
      <div>
        <h2 className="text-heading text-text-primary mb-1">Trader Profile</h2>
        <p className="text-body text-text-muted">Track your progress and achievements.</p>
      </div>

      {/* Level card */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-surface-card">
        <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-signal-blue bg-surface-row text-signal-blue text-xl font-bold">
          {level.level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-text-primary">{level.title}</div>
          <div className="text-label text-text-muted mt-0.5">
            {level.xpCurrent} / {level.xpNext} XP to Level {level.level + 1}
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-row overflow-hidden">
            <div
              className="h-full rounded-full bg-signal-blue transition-all"
              style={{ width: `${level.progress}%` }}
            />
          </div>
        </div>
        <div className="text-heading font-semibold text-signal-blue tabular-nums">
          {state.xp}<span className="text-label text-text-muted"> XP</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="Total Trades" value={closedTrades.length} />
        <StatCard label="Win Streak" value={winStreak} accent={winStreak >= 3 ? "text-signal-green" : undefined} />
        <StatCard label="Best Streak" value={bestWinStreak} accent={bestWinStreak >= 3 ? "text-signal-green" : undefined} />
        <StatCard label="Loss Streak" value={lossStreak} accent={lossStreak >= 3 ? "text-signal-red" : undefined} />
        <StatCard label="Won Today" value={wonToday ? "Yes" : "No"} accent={wonToday ? "text-signal-green" : "text-text-muted"} />
        <StatCard
          label="Total P&L"
          value={`$${closedTrades.reduce((s, t) => s + t.netPnl, 0).toFixed(0)}`}
          accent={closedTrades.reduce((s, t) => s + t.netPnl, 0) >= 0 ? "text-signal-green" : "text-signal-red"}
        />
      </div>

      {/* Badges grid */}
      <div>
        <h3 className="text-body text-text-secondary mb-3">Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {allBadges.map((badge) => {
            const earned = !!gamification.earnedBadges[badge.id];
            const earnedDate = gamification.earnedBadges[badge.id];
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border ${
                  earned
                    ? "border-signal-green/30 bg-signal-greenBg/20"
                    : "border-border bg-surface-card/50 opacity-40"
                }`}
              >
                <span className="text-lg">{earned ? "★" : "☆"}</span>
                <span className={`text-label font-semibold ${earned ? "text-text-primary" : "text-text-muted"}`}>
                  {badge.name}
                </span>
                {earned && earnedDate && (
                  <span className="text-[10px] text-text-muted">
                    {new Date(earnedDate).toLocaleDateString()}
                  </span>
                )}
                <span className="text-[10px] text-text-muted text-center">{badge.description}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card flex flex-col gap-1 min-w-[120px]">
      <span className="text-label text-text-muted">{label}</span>
      <span className={`text-body font-semibold tabular-nums ${accent ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
}
