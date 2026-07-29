import type { Request, Response } from "express";
import type pg from "pg";
import { buildLeaderboard, type HandRow } from "../leaderboard.js";

export function createLeaderboardRouteHandler(pool: pg.Pool) {
  return async function handleGetLeaderboard(_req: Request, res: Response) {
    try {
      const { rows } = await pool.query<{ device_id: string; correct_decisions: number; total_decisions: number }>(
        `SELECT device_id, correct_decisions, total_decisions FROM hands`,
      );
      const hands: HandRow[] = rows.map((r) => ({
        deviceId: r.device_id,
        correctDecisions: r.correct_decisions,
        totalDecisions: r.total_decisions,
      }));
      const leaderboard = buildLeaderboard(hands).slice(0, 10);
      res.json({ leaderboard });
    } catch (err) {
      console.error("Failed to build leaderboard:", err);
      res.status(500).json({ error: "Internal error building leaderboard." });
    }
  };
}
