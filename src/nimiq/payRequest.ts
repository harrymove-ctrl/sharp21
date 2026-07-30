/**
 * "Scan to pay" support: lets someone play Sharp21 from a plain web browser
 * (desktop or mobile) without ever opening the mini-app inside Nimiq Pay.
 * Nimiq mini-apps can only connect a wallet from inside Nimiq Pay itself -
 * there's no browser-based connect flow to fall back to. But Nimiq Pay's
 * built-in QR scanner can complete a payment to ANY `nimiq:` payment-request
 * link from any device, with no mini-app involved at all. The payment
 * happens wallet-to-wallet; we get no txHash back directly, so the backend
 * polls the chain for the matching incoming transaction instead (see
 * server/src/pay.ts).
 *
 * Unlike a per-creator tip jar, every Sharp21 player pays the SAME treasury
 * address using only 3 possible amounts (1/2/5 NIM) - "amount + recipient"
 * alone is nowhere near unique enough to attribute a payment to the right
 * player once there's any concurrent traffic. Every payment therefore
 * carries a nonce in its on-chain message, and the backend match is REQUIRED
 * to include that nonce - amount/recipient/freshness alone is never enough
 * on its own.
 */

/** On-chain message byte cap enforced by Nimiq core (BasicAccount). */
export const MESSAGE_MAX_BYTES = 64;

/** Nonce tag prefix embedded in the message so the backend can match the paid tx. */
const NONCE_PREFIX = "sharp21#";

/** Generate a short, URL/message-safe attribution nonce (base36). */
export function generatePayNonce(): string {
  // 6 base36 chars ~ 2 billion combos - ample within one bet's detection window.
  const rand = Math.floor(Math.random() * 36 ** 6);
  return rand.toString(36).padStart(6, "0");
}

/** The on-chain message for a given nonce - just the attribution tag, nothing else. */
export function composePayMessage(nonce: string): string {
  return `${NONCE_PREFIX}${nonce}`;
}

/** True if an on-chain message carries this attribution nonce. */
export function messageHasNonce(message: string | undefined | null, nonce: string): boolean {
  if (!message || !nonce) return false;
  return message.includes(`${NONCE_PREFIX}${nonce}`);
}

/**
 * Build a `nimiq:` payment-request URI that Nimiq Pay's scanner opens as a
 * prefilled payment. Follows @nimiq/utils' RequestLinkEncoding (URI type):
 *   nimiq:<ADDRESS>?amount=<NIM>&message=<uriEncoded>
 */
export function buildNimiqPaymentUri(params: { address: string; amountNIM: number; message: string }): string {
  const recipient = params.address.replace(/ /g, "");
  const query = [`amount=${params.amountNIM}`, `message=${encodeURIComponent(params.message)}`];
  return `nimiq:${recipient}?${query.join("&")}`;
}
