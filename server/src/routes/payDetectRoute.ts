import type { Request, Response } from "express";
import { findIncomingPayment, TREASURY_ADDRESS } from "../pay.js";

/**
 * GET /api/pay/detect?nonce=&amountLuna=&sinceMs=
 * Polled by the frontend's ScanToPay flow. Returns { found:false } or
 * { found:true, txHash, senderAddress } - see pay.ts for the matching
 * strategy and its disclosed reliability caveats.
 */
export function createDetectPaymentHandler() {
  return async function handleDetectPayment(req: Request, res: Response) {
    const nonce = String(req.query.nonce ?? "").trim();
    const amountLuna = Number(req.query.amountLuna);
    const sinceMs = Number(req.query.sinceMs);

    if (!nonce || !Number.isInteger(amountLuna) || amountLuna <= 0 || !Number.isFinite(sinceMs)) {
      res.status(400).json({ error: "nonce, amountLuna, and sinceMs are required" });
      return;
    }

    try {
      const found = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna, nonce, sinceMs });
      if (!found) {
        res.json({ found: false });
        return;
      }
      res.json({ found: true, txHash: found.txHash, senderAddress: found.senderAddress });
    } catch (err) {
      console.error("Failed to check for incoming payment:", err);
      res.status(500).json({ error: "Internal error checking payment status." });
    }
  };
}
