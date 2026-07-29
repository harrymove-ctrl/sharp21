const BACKEND_URL = "https://sharp21-backend-production.up.railway.app";

export interface RecordHandInput {
  deviceId: string;
  correctDecisions: number;
  totalDecisions: number;
  wagerLuna: number;
  entryFeeTxHash: string;
  payoutAddress: string;
}

/** Best-effort: a failure here should never block the player from continuing to play. */
export async function recordHand(input: RecordHandInput): Promise<void> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/hands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.warn("Failed to record hand on the backend:", res.status, await res.text());
    }
  } catch (err) {
    console.warn("Failed to record hand on the backend:", err);
  }
}

export interface LeaderboardEntry {
  deviceId: string;
  correctDecisions: number;
  totalDecisions: number;
  handsPlayed: number;
  rank: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BACKEND_URL}/api/leaderboard`);
  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`);
  const data = (await res.json()) as { leaderboard: LeaderboardEntry[] };
  return data.leaderboard;
}
