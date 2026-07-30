/**
 * Chain-side half of the "scan to pay" flow (see the frontend's
 * src/nimiq/payRequest.ts for why this exists). Recipient + amount alone
 * are NOT enough to attribute a payment here - unlike a per-creator tip
 * jar, every Sharp21 player pays this SAME treasury address using only 3
 * possible amounts, so under any real concurrent traffic two players
 * betting the same amount within the same window could get
 * cross-attributed. A payment is therefore only ever treated as a match
 * when its on-chain message carries the exact nonce that specific bet
 * generated - never on amount/recipient/freshness alone.
 *
 * Data source: the public nimiqwatch block explorer API. There is no
 * confirmed-working public Nimiq RPC endpoint wired up here (see
 * looksLikeTxHash's comment - the same gap). This has been observed taking
 * ~10-15s per call, and its testnet coverage is UNVERIFIED (it returned an
 * empty result for this project's funded testnet treasury address in
 * manual testing) - treat detection latency and reliability as best-effort
 * until proven otherwise against a real payment.
 */

/**
 * Nimiq PoS *testnet* treasury address - mirrors the frontend's
 * src/nimiq/client.ts TREASURY_ADDRESS. A public address, not a secret;
 * duplicated deliberately rather than imported across the frontend/backend
 * boundary, same as this file's nonce prefix mirrors payRequest.ts's.
 */
export const TREASURY_ADDRESS = "NQ88 1JXU LCMY 92X0 VY6J SXXS 1VSY XLLB 5TVF";

const NONCE_PREFIX = "sharp21#";

function messageHasNonce(message: string | undefined | null, nonce: string): boolean {
  if (!message || !nonce) return false;
  return message.includes(`${NONCE_PREFIX}${nonce}`);
}

function normalizeAddress(address: string): string {
  return address.replace(/ /g, "").toUpperCase();
}

/** On-chain `data`/`extra_data` is often hex-encoded UTF-8; decode it if it looks like hex. */
function decodeMessage(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    try {
      return Buffer.from(raw, "hex").toString("utf8");
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Read a tx timestamp in ms across the explorer's various possible shapes. */
function txTimeMs(tx: Record<string, unknown>): number {
  const raw = tx.timestamp ?? tx.time ?? tx.date ?? tx.blockTime ?? 0;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw; // secs -> ms
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface FoundPayment {
  txHash: string;
  senderAddress: string;
}

/** The explorer's response shape isn't documented anywhere reachable - handle a plain array or either common wrapper key. */
function extractTxArray(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.transactions)) return obj.transactions as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

/**
 * Look for an incoming transaction to `treasuryAddress`, for the exact
 * `amountLuna`, sent at/after `sinceMs`, whose on-chain message carries
 * `nonce`. Returns null on no match OR if the explorer itself is
 * unreachable - both are just "not found yet" from the caller's
 * perspective (the frontend keeps polling).
 */
export async function findIncomingPayment(params: {
  treasuryAddress: string;
  amountLuna: number;
  nonce: string;
  sinceMs: number;
}): Promise<FoundPayment | null> {
  const recipientNorm = normalizeAddress(params.treasuryAddress);
  const addrStripped = params.treasuryAddress.replace(/ /g, "");

  let txs: Record<string, unknown>[] = [];
  try {
    const resp = await fetch(
      `https://v2.nimiqwatch.com/api/v1/account-transactions/${encodeURIComponent(addrStripped)}/1`,
      { headers: { Accept: "application/json", "User-Agent": "Sharp21/1.0" } },
    );
    if (!resp.ok) return null;
    const json: unknown = await resp.json();
    txs = extractTxArray(json);
  } catch {
    return null;
  }

  for (const tx of txs) {
    const to = normalizeAddress(
      String(tx.receiver_address ?? tx.toAddress ?? tx.to ?? tx.to_address ?? tx.recipient ?? tx.recipientAddress ?? ""),
    );
    if (to !== recipientNorm) continue;

    const value = Number(tx.value ?? tx.amount ?? tx.luna ?? 0);
    if (Math.abs(value - params.amountLuna) > 1000) continue; // small integer-rounding tolerance

    const time = txTimeMs(tx);
    if (time !== 0 && time < params.sinceMs - 60_000) continue; // allow 1 min clock skew

    const msg = decodeMessage(tx.data ?? tx.message ?? tx.extraData ?? tx.extra_data);
    if (!messageHasNonce(msg, params.nonce)) continue; // strict: never fall back to amount+recipient alone

    const hash = String(tx.hash ?? tx.transactionHash ?? tx.id ?? "");
    const sender = String(tx.sender_address ?? tx.fromAddress ?? tx.from ?? tx.from_address ?? tx.senderAddress ?? tx.sender ?? "");
    if (!hash || !sender) continue;

    return { txHash: hash, senderAddress: sender };
  }
  return null;
}
