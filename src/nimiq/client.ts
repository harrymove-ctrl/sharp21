import { getHostLanguage, init, requestDeviceIdentifier } from "@nimiq/mini-app-sdk";

const LUNA_PER_NIM = 100_000;

/**
 * TODO(real treasury): this must be replaced with the project's actual NIM
 * receiving address before any real entry fee is collected. A wrong or
 * placeholder address here would send real user funds nowhere recoverable -
 * do not remove this guard without setting a real address first.
 */
export const TREASURY_ADDRESS = "REPLACE_WITH_REAL_TREASURY_NIM_ADDRESS";

/**
 * Synchronous, safe-to-call-anytime check for whether we're actually running
 * inside the Nimiq Pay WebView. `getHostLanguage()` is seeded before page
 * scripts run and returns undefined outside that host - this is cheaper and
 * more honest than racing `init()` against a timeout just to find out we're
 * in a plain browser tab.
 */
export function isNimiqPayHost(): boolean {
  return getHostLanguage() !== undefined;
}

export async function getDeviceId(): Promise<string> {
  return requestDeviceIdentifier({ reason: "Rank you on the Sharp21 skill leaderboard" });
}

export type PaymentResult = { ok: true; txHash: string } | { ok: false; message: string };

export async function payEntryFee(nimAmount: number, treasuryAddress: string): Promise<PaymentResult> {
  if (!treasuryAddress || treasuryAddress.startsWith("REPLACE_WITH")) {
    return { ok: false, message: "No treasury address configured yet - entry fees can't be collected." };
  }
  try {
    const provider = await init({ timeout: 4000 });
    const result = await provider.sendBasicTransaction({
      recipient: treasuryAddress,
      value: Math.round(nimAmount * LUNA_PER_NIM),
    });
    if (typeof result === "string") {
      return { ok: true, txHash: result };
    }
    return { ok: false, message: result.error.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Wallet request failed." };
  }
}
