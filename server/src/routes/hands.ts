import type { Request, Response } from "express";
import type pg from "pg";
import { looksLikeTxHash } from "../nimiqRpc.js";

export interface RecordHandBody {
  deviceId: string;
  correctDecisions: number;
  totalDecisions: number;
  wagerLuna: number;
  entryFeeTxHash: string;
  payoutAddress: string;
}

/** Mini-app path: a 64-char hex device identifier from requestDeviceIdentifier(). */
function isDeviceId(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

/**
 * Scan-to-pay path: no device identifier is available outside Nimiq Pay, so
 * the paying wallet's own address is used as the leaderboard identity
 * instead - a fine, stable key in its own right. "NQ" + 2 check digits + 32
 * base32-ish chars, spaces stripped before checking.
 */
function isNimiqAddressLike(s: string): boolean {
  return /^NQ\d{2}[0-9A-Z]{32}$/i.test(s.replace(/ /g, ""));
}

export function validateHandBody(body: unknown): { ok: true; value: RecordHandBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.deviceId !== "string" || !(isDeviceId(b.deviceId) || isNimiqAddressLike(b.deviceId))) {
    return { ok: false, error: "deviceId must be a 64-char device identifier or a Nimiq wallet address" };
  }
  if (typeof b.correctDecisions !== "number" || !Number.isInteger(b.correctDecisions) || b.correctDecisions < 0) {
    return { ok: false, error: "correctDecisions must be a non-negative integer" };
  }
  if (typeof b.totalDecisions !== "number" || !Number.isInteger(b.totalDecisions) || b.totalDecisions < b.correctDecisions) {
    return { ok: false, error: "totalDecisions must be an integer >= correctDecisions" };
  }
  if (typeof b.wagerLuna !== "number" || !Number.isInteger(b.wagerLuna) || b.wagerLuna <= 0) {
    return { ok: false, error: "wagerLuna must be a positive integer" };
  }
  if (typeof b.entryFeeTxHash !== "string" || !looksLikeTxHash(b.entryFeeTxHash)) {
    return { ok: false, error: "entryFeeTxHash does not look like a transaction hash" };
  }
  if (typeof b.payoutAddress !== "string" || !b.payoutAddress.startsWith("NQ")) {
    return { ok: false, error: "payoutAddress must be a Nimiq address" };
  }
  return {
    ok: true,
    value: {
      deviceId: b.deviceId,
      correctDecisions: b.correctDecisions,
      totalDecisions: b.totalDecisions,
      wagerLuna: b.wagerLuna,
      entryFeeTxHash: b.entryFeeTxHash,
      payoutAddress: b.payoutAddress,
    },
  };
}

export function createHandsRouteHandler(pool: pg.Pool) {
  return async function handleRecordHand(req: Request, res: Response) {
    const validation = validateHandBody(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const v = validation.value;
    try {
      await pool.query(
        `INSERT INTO hands (device_id, correct_decisions, total_decisions, wager_luna, entry_fee_tx_hash, payout_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [v.deviceId, v.correctDecisions, v.totalDecisions, v.wagerLuna, v.entryFeeTxHash, v.payoutAddress],
      );
      res.status(201).json({ ok: true });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        // unique_violation on entry_fee_tx_hash - the same payment can't fund two hands.
        res.status(409).json({ error: "This transaction has already been recorded." });
        return;
      }
      console.error("Failed to record hand:", err);
      res.status(500).json({ error: "Internal error recording hand." });
    }
  };
}
