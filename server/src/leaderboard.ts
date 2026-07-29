export interface HandRow {
  deviceId: string;
  correctDecisions: number;
  totalDecisions: number;
}

export interface LeaderboardEntry {
  deviceId: string;
  correctDecisions: number;
  totalDecisions: number;
  handsPlayed: number;
  rank: number;
}

// Mirrors Forecast's "5 distinct markets" eligibility pattern - filters out
// zero-effort entries, not a claim that 10 hands is itself hard to reach.
export const MIN_HANDS_FOR_ELIGIBILITY = 10;

// One-time payout, not the weekly-recurring curve the original design spec
// sketched - there is no "next week" for an ineligible share to carry over
// into, so unlike that spec this simply pays out to however many eligible
// entries exist, up to 10.
export const PAYOUT_CURVE_PERCENT = [30, 20, 15, 10, 8, 6, 5, 3, 2, 1];

export function aggregateHands(hands: HandRow[]): Map<string, Omit<LeaderboardEntry, "deviceId" | "rank">> {
  const byDevice = new Map<string, Omit<LeaderboardEntry, "deviceId" | "rank">>();
  for (const h of hands) {
    const cur = byDevice.get(h.deviceId) ?? { correctDecisions: 0, totalDecisions: 0, handsPlayed: 0 };
    cur.correctDecisions += h.correctDecisions;
    cur.totalDecisions += h.totalDecisions;
    cur.handsPlayed += 1;
    byDevice.set(h.deviceId, cur);
  }
  return byDevice;
}

export function buildLeaderboard(hands: HandRow[], minHands: number = MIN_HANDS_FOR_ELIGIBILITY): LeaderboardEntry[] {
  const byDevice = aggregateHands(hands);
  const eligible = Array.from(byDevice.entries())
    .map(([deviceId, stats]) => ({ deviceId, ...stats, rank: 0 }))
    .filter((e) => e.handsPlayed >= minHands)
    // Ties broken by hands played (rewards sustained correct play over a
    // single lucky lookup), then device id for a fully deterministic order.
    .sort((a, b) => b.correctDecisions - a.correctDecisions || b.handsPlayed - a.handsPlayed || a.deviceId.localeCompare(b.deviceId));
  return eligible.map((e, i) => ({ ...e, rank: i + 1 }));
}

export interface Payout {
  deviceId: string;
  rank: number;
  percentOfPool: number;
  amountLuna: number;
}

/** totalPoolLuna is the sum of every wager in the window, eligible or not - everyone's fee funds the pool, only eligible ranks draw from it. */
export function computePayouts(leaderboard: LeaderboardEntry[], totalPoolLuna: number): Payout[] {
  if (totalPoolLuna < 0) throw new Error("totalPoolLuna must not be negative");
  const winners = leaderboard.slice(0, PAYOUT_CURVE_PERCENT.length);
  return winners.map((entry, i) => {
    const percent = PAYOUT_CURVE_PERCENT[i];
    return {
      deviceId: entry.deviceId,
      rank: entry.rank,
      percentOfPool: percent,
      amountLuna: Math.floor((totalPoolLuna * percent) / 100),
    };
  });
}
