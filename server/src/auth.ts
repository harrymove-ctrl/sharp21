import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time compare of an `Authorization: Bearer <token>` header against an expected secret. */
export function bearerTokenMatches(authHeader: string | undefined, expected: string | undefined): boolean {
  if (!expected) return false; // never "authenticate" against an unset/empty expected token
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal-length buffers
  return timingSafeEqual(a, b);
}

export interface PayoutLine {
  deviceId: string;
  payoutAddress: string;
  rank: number;
  amountLuna: number;
}

/** Deterministic id for a computed batch, so the local signer can verify it received the exact same data twice. */
export function computeBatchId(windowId: string | number, payouts: PayoutLine[]): string {
  const sorted = [...payouts].sort((a, b) => a.rank - b.rank);
  const canonical = JSON.stringify({ windowId: String(windowId), payouts: sorted });
  return createHash("sha256").update(canonical).digest("hex");
}
