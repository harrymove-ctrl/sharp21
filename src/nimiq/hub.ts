import HubApi from "@nimiq/hub-api";
import { LUNA_PER_NIM, withTimeout, type PaymentResult } from "./client";

/**
 * Nimiq Hub - a genuine browser-based wallet (unlike @nimiq/mini-app-sdk,
 * which only works loaded inside Nimiq Pay). Hub IS the account/keyguard UI
 * itself, opened in a popup: a visitor with no wallet at all can create one
 * right there, no separate extension or app required. This is a third path
 * alongside "Open in Nimiq Pay" and "Scan to pay" - the only one that lets
 * someone play directly in a desktop browser with no phone involved at all.
 *
 * Endpoint is pinned to the *testnet* Hub, matching client.ts's testnet
 * TREASURY_ADDRESS - Hub's own default-endpoint detection keys off the
 * page's hostname (only auto-picks testnet on a *.nimiq-testnet.com
 * origin), which GitHub Pages never matches, so this must be explicit
 * rather than left to the library's default. Swap to https://hub.nimiq.com
 * together with TREASURY_ADDRESS when moving to mainnet.
 */
const HUB_ENDPOINT = "https://hub.nimiq-testnet.com";

let hubApi: HubApi | null = null;

function getHub(): HubApi {
  if (!hubApi) {
    hubApi = new HubApi(HUB_ENDPOINT);
  }
  return hubApi;
}

/**
 * Opens a Hub popup to pick (or create) an account. Returns the chosen
 * address, or null if the user closes the popup or it fails to load -
 * never throws, this is a user-initiated "try again" action, not a
 * required background step.
 */
export async function connectHubWallet(): Promise<string | null> {
  try {
    const result = await withTimeout(
      getHub().chooseAddress({ appName: "Sharp21" }),
      5 * 60_000,
      "Didn't hear back from the wallet in time.",
    );
    return result.address;
  } catch {
    return null;
  }
}

/**
 * Opens a Hub checkout popup for a direct NIM payment and returns the
 * resulting transaction hash - no chain-polling needed, unlike scan-to-pay,
 * since Hub hands the signed transaction straight back to this page.
 */
export async function payViaHub(nimAmount: number, treasuryAddress: string): Promise<PaymentResult> {
  try {
    const result = await withTimeout(
      getHub().checkout({
        appName: "Sharp21",
        recipient: treasuryAddress,
        value: Math.round(nimAmount * LUNA_PER_NIM),
      }),
      5 * 60_000,
      "Didn't hear back from the wallet in time.",
    );
    return { ok: true, txHash: result.hash };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Hub payment failed." };
  }
}
