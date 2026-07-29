import { createHash } from "node:crypto";

export interface PayoutLine {
  deviceId: string;
  payoutAddress: string;
  rank: number;
  amountLuna: number;
}

/**
 * Must stay byte-for-byte identical to server/src/auth.ts's computeBatchId.
 * Deliberately duplicated rather than imported - this script is a standalone
 * deployable unit that must never depend on the backend's node_modules or
 * source tree at runtime.
 */
export function computeBatchId(windowId: string | number, payouts: PayoutLine[]): string {
  const sorted = [...payouts].sort((a, b) => a.rank - b.rank);
  const canonical = JSON.stringify({ windowId: String(windowId), payouts: sorted });
  return createHash("sha256").update(canonical).digest("hex");
}
