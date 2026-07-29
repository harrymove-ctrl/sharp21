import type { Request, Response } from "express";
import type pg from "pg";
import { bearerTokenMatches, computeBatchId, type PayoutLine } from "../auth.js";
import { buildLeaderboard, computePayouts, type HandRow } from "../leaderboard.js";

export function createGetPayoutBatchHandler(pool: pg.Pool) {
  return async function handleGetPayoutBatch(req: Request, res: Response) {
    if (!bearerTokenMatches(req.headers.authorization, process.env.PAYOUT_READ_TOKEN)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const windowResult = await pool.query<{ id: number }>(
      `SELECT id FROM payout_windows WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1`,
    );
    const window = windowResult.rows[0];
    if (!window) {
      res.status(404).json({ error: "No closed payout window found yet." });
      return;
    }

    const { rows } = await pool.query<{
      device_id: string;
      correct_decisions: number;
      total_decisions: number;
      wager_luna: string;
      payout_address: string;
    }>(`SELECT device_id, correct_decisions, total_decisions, wager_luna, payout_address FROM hands`);

    const hands: HandRow[] = rows.map((r) => ({
      deviceId: r.device_id,
      correctDecisions: r.correct_decisions,
      totalDecisions: r.total_decisions,
    }));
    // Latest reported payout address per device wins - a device could in
    // principle report different addresses across hands; there is
    // deliberately no attempt here to reconcile that beyond "most recent."
    const addressByDevice = new Map<string, string>();
    for (const r of rows) addressByDevice.set(r.device_id, r.payout_address);
    const totalPoolLuna = rows.reduce((sum, r) => sum + Number(r.wager_luna), 0);

    const leaderboard = buildLeaderboard(hands);
    const payouts = computePayouts(leaderboard, totalPoolLuna);
    const payoutLines: PayoutLine[] = payouts.map((p) => ({
      deviceId: p.deviceId,
      payoutAddress: addressByDevice.get(p.deviceId) ?? "",
      rank: p.rank,
      amountLuna: p.amountLuna,
    }));
    const batchId = computeBatchId(window.id, payoutLines);

    await pool.query(
      `INSERT INTO payout_batches (batch_id, window_id, payouts, total_luna)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (batch_id) DO NOTHING`,
      [batchId, window.id, JSON.stringify(payoutLines), totalPoolLuna],
    );

    res.json({ batchId, windowId: window.id, payouts: payoutLines, totalLuna: totalPoolLuna });
  };
}

export function createConfirmPayoutBatchHandler(pool: pg.Pool) {
  return async function handleConfirmPayoutBatch(req: Request, res: Response) {
    if (!bearerTokenMatches(req.headers.authorization, process.env.PAYOUT_CONFIRM_TOKEN)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { batchId } = req.params;
    // TODO(on-chain verification): this trusts the reported txHash without
    // checking it on-chain, same disclosed gap as hands recording - see
    // src/nimiqRpc.ts. Confirmation here is bookkeeping only; the owner's
    // manual leaderboard-diff step (see scripts/payout/signer.ts) is the
    // real check today.
    const result = await pool.query(
      `UPDATE payout_batches SET confirmed_at = now() WHERE batch_id = $1 AND confirmed_at IS NULL RETURNING batch_id`,
      [batchId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Batch not found or already confirmed." });
      return;
    }
    res.json({ ok: true });
  };
}
