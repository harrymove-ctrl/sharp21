import { getHostLanguage, init, requestDeviceIdentifier } from "@nimiq/mini-app-sdk";

export const LUNA_PER_NIM = 100_000;

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
 * Memoized connection to the host - init() only needs to run once per
 * session, not on every call. Reset to null on failure (rather than either
 * caching forever, which poisons every later call after one bad connection,
 * or never caching, which re-runs init()'s handshake on every single call)
 * so the next attempt gets a clean retry instead of the same failure.
 */
let providerPromise: ReturnType<typeof init> | null = null;

function getProvider() {
  if (!providerPromise) {
    providerPromise = init({ timeout: 4000 }).catch((err) => {
      providerPromise = null;
      throw err;
    });
  }
  return providerPromise;
}

/** Test-only: the memoization above is exactly what real usage wants (one
 *  handshake per session), but it means each test's `init()` mock would
 *  otherwise leak into every later test in the same file - clear it between
 *  cases instead. Not meant to be called from application code. */
export function __resetProviderCacheForTests(): void {
  providerPromise = null;
}

/**
 * init()'s own timeout only covers the initial handshake - once a provider
 * is cached, calls made through it (listAccounts, sendBasicTransaction, ...)
 * have no timeout of their own and can hang forever if the host never
 * responds (backgrounded app, dropped bridge, ignored prompt). That leaves
 * the UI stuck - e.g. "Confirm the payment in your wallet..." with no way
 * out but a page reload. Every provider call below is wrapped in this so a
 * silent hang always resolves into a normal, recoverable error instead.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Resolves the user's first connected Nimiq address, or null if the wallet
 * has none, refuses (an ErrorResponse), or the request fails outright (e.g.
 * the user declines the confirmation prompt). Never throws - this is a
 * best-effort "who's connected" display, not a required step.
 */
export async function getConnectedAccount(): Promise<string | null> {
  try {
    const provider = await getProvider();
    const accounts = await withTimeout(provider.listAccounts(), 8000, "Wallet didn't respond in time.");
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
    const provider = await getProvider();
    return await withTimeout(provider.isConsensusEstablished(), 8000, "Wallet didn't respond in time.");
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
    const provider = await getProvider();
    // Longer than the other timeouts - this one waits on the user actually
    // looking at a confirmation prompt in their wallet, not just a bridge
    // round-trip, so it needs real room before treating silence as a hang.
    const result = await withTimeout(
      provider.sendBasicTransaction({
        recipient: treasuryAddress,
        value: Math.round(nimAmount * LUNA_PER_NIM),
      }),
      90_000,
      "Wallet didn't respond in time - try again.",
    );
    if (typeof result === "string") {
      return { ok: true, txHash: result };
    }
    return { ok: false, message: result.error.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Wallet request failed." };
  }
}

/** Deep-link + universal-link opener for people outside Nimiq Pay. */
export function openerLinks(): { https: string; scheme: string } {
  const url = window.location.href;
  return {
    https: `https://nimpay.app/miniapps/open/${window.location.host}${window.location.pathname}`,
    scheme: `nimiqpay://miniapp?url=${encodeURIComponent(url)}`,
  };
}

/** Real store listings for Nimiq Pay - the fallback when the app isn't installed. */
export const STORE_LINKS: Record<"ios" | "android", string> = {
  ios: "https://apps.apple.com/ng/app/nimiq-pay/id6471844738",
  android: "https://play.google.com/store/apps/details?id=com.nimiq.pay",
};

export function detectPlatform(): "ios" | "android" | "unknown" {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "unknown";
}

/**
 * Social apps' built-in browsers (Snapchat, Instagram, TikTok, Facebook, LINE)
 * block custom URL scheme redirects and often interfere with universal links
 * too, as an anti-hijacking measure. Detect these so we can tell people to
 * switch to their real browser instead of silently failing to redirect.
 */
export function inAppBrowserName(): string | null {
  const ua = navigator.userAgent || "";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook";
  if (/TikTok|Bytedance/i.test(ua)) return "TikTok";
  if (/Line\//i.test(ua)) return "LINE";
  return null;
}
