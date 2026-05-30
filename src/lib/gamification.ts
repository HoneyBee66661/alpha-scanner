import type { ClosedTrade } from '../types/index.js';

export interface GamificationState {
  xp: number;
  earnedBadges: Record<string, number>; // badgeId -> timestamp
  lastLoginDate: string; // YYYY-MM-DD
}

const LEVELS = [
  { level: 1, xp: 0, title: "Novice Trader" },
  { level: 2, xp: 200, title: "Apprentice Trader" },
  { level: 3, xp: 500, title: "Journey Trader" },
  { level: 4, xp: 1000, title: "Consistent Trader" },
  { level: 5, xp: 2000, title: "Skilled Trader" },
  { level: 6, xp: 3500, title: "Expert Trader" },
  { level: 7, xp: 5500, title: "Master Trader" },
  { level: 8, xp: 8000, title: "Elite Trader" },
  { level: 9, xp: 11000, title: "Legendary Trader" },
  { level: 10, xp: 15000, title: "Alpha Trader" },
];

const BADGES: { id: string; name: string; description: string }[] = [
  { id: "first_trade", name: "First Trade", description: "Close your first paper trade" },
  { id: "green_day", name: "Green Day", description: "Close a profitable trade" },
  { id: "on_a_roll", name: "On a Roll", description: "3 consecutive winning trades" },
  { id: "trader", name: "Trader", description: "10 closed trades" },
  { id: "consistent", name: "Consistent", description: "5-day trading streak" },
  { id: "dedicated", name: "Dedicated", description: "10-day trading streak" },
  { id: "pro", name: "Pro", description: "Reach Level 5" },
  { id: "elite", name: "Elite", description: "Reach Level 8" },
  { id: "comeback", name: "Comeback", description: "Win after 3+ losing trades" },
  { id: "volume", name: "Volume Trader", description: "50 closed trades" },
  { id: "profit_machine", name: "Profit Machine", description: "$1,000 total net P&L" },
];

export function getInitialGamificationState(): GamificationState {
  return { xp: 0, earnedBadges: {}, lastLoginDate: "" };
}

export function computeGamification(
  closedTrades: ClosedTrade[],
  current: GamificationState
): GamificationState {
  let xp = 0;

  for (const t of closedTrades) {
    xp += 10;
    if (t.netPnl > 0) xp += 25;
    xp += Math.min(Math.abs(t.netReturnPct) * 5, 50);
  }

  // Daily login bonus
  const today = new Date().toISOString().slice(0, 10);
  if (current.lastLoginDate !== today) {
    xp += 5;
  }

  // Trading day streak bonus
  const distinctDays = new Set(
    closedTrades.map((t) => new Date(t.exitTimestamp).toISOString().slice(0, 10))
  );
  if (distinctDays.size >= 1) {
    xp += distinctDays.size * 15;
  }

  return {
    xp: Math.round(xp),
    earnedBadges: current.earnedBadges,
    lastLoginDate: today,
  };
}

export function checkNewBadges(
  closedTrades: ClosedTrade[],
  gamification: GamificationState,
  currentLevel: number
): { id: string; name: string; description: string }[] {
  const earned = gamification.earnedBadges;
  const sorted = [...closedTrades].sort((a, b) => a.exitTimestamp - b.exitTimestamp);
  const totalTrades = closedTrades.length;
  const totalPnl = closedTrades.reduce((s, t) => s + t.netPnl, 0);
  const wins = closedTrades.filter((t) => t.netPnl > 0).length;

  // Compute win streaks
  let winStreak = 0;
  let bestWinStreak = 0;
  let lossStreak = 0;
  for (const t of sorted) {
    if (t.netPnl > 0) { winStreak++; lossStreak = 0; if (winStreak > bestWinStreak) bestWinStreak = winStreak; }
    else { lossStreak++; winStreak = 0; }
  }

  // Trading day streak
  const days = new Set(closedTrades.map((t) => new Date(t.exitTimestamp).toISOString().slice(0, 10)));
  let dayStreak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().slice(0, 10))) { dayStreak++; }
    else break;
  }

  const newBadges: { id: string; name: string; description: string }[] = [];

  function check(id: string, cond: boolean) {
    if (!earned[id] && cond) {
      const badge = BADGES.find((b) => b.id === id)!;
      newBadges.push(badge);
      earned[id] = Date.now();
    }
  }

  check("first_trade", totalTrades >= 1);
  check("green_day", wins >= 1);
  check("on_a_roll", bestWinStreak >= 3);
  check("trader", totalTrades >= 10);
  check("consistent", dayStreak >= 5);
  check("dedicated", dayStreak >= 10);
  check("pro", currentLevel >= 5);
  check("elite", currentLevel >= 8);
  check("comeback", lossStreak >= 3 && winStreak >= 1);
  check("volume", totalTrades >= 50);
  check("profit_machine", totalPnl >= 1000);

  return newBadges;
}

export function computeLevel(xp: number): { level: number; title: string; progress: number; xpCurrent: number; xpNext: number } {
  let level = 1;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) { level = LEVELS[i].level; break; }
  }
  const currentLevel = LEVELS[level - 1];
  const nextLevel = LEVELS[level] ?? { xp: currentLevel.xp * 2 };
  const xpCurrent = xp - currentLevel.xp;
  const xpNext = nextLevel.xp - currentLevel.xp;
  const progress = xpNext > 0 ? Math.min(100, Math.round((xpCurrent / xpNext) * 100)) : 100;
  return { level: currentLevel.level, title: currentLevel.title, progress, xpCurrent, xpNext };
}

export function getAllBadges(): typeof BADGES {
  return BADGES;
}
