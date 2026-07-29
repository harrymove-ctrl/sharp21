import { getHostLanguage, init, requestDeviceIdentifier } from "@nimiq/mini-app-sdk";

const LUNA_PER_NIM = 100_000;

/**
 * Nimiq PoS *testnet* treasury address (funded via the testnet faucet -
 * zero real value). Fine for exercising the real payment flow end-to-end
 * inside Nimiq Pay's testnet mode. Must be swapped for a real mainnet
 * address, generated and held by the project owner, before this ever
 * collects real entry fees - do not repurpose this one for that.
 */
export const TREASURY_ADDRESS = "NQ88 1JXU LCMY 92X0 VY6J SXXS 1VSY XLLB 5TVF";

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

/**
 * Resolves the user's first connected Nimiq address, or null if the wallet
 * has none, refuses (an ErrorResponse), or the request fails outright (e.g.
 * the user declines the confirmation prompt). Never throws - this is a
 * best-effort "who's connected" display, not a required step.
 */
export async function getConnectedAccount(): Promise<string | null> {
  try {
    const provider = await init({ timeout: 4000 });
    const accounts = await provider.listAccounts();
    if (Array.isArray(accounts) && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whether the Nimiq network's consensus is established, checked as a
 * pre-flight before requesting payment so a not-ready network surfaces as a
 * clear message instead of an opaque hang or failure inside sendBasicTransaction.
 */
export async function isNetworkReady(): Promise<boolean> {
  try {
    const provider = await init({ timeout: 4000 });
    return await provider.isConsensusEstablished();
  } catch {
    return false;
  }
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
