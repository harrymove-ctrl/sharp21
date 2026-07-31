const FAUCET_URL = "https://faucet.pos.nimiq-testnet.com/tapit";

export type FaucetResult = { ok: true } | { ok: false; message: string };

/**
 * Testnet-only - mints free NIM to any address, zero real value. Same
 * endpoint used earlier to fund TREASURY_ADDRESS itself; safe to call
 * directly on a player's behalf since there's nothing to lose here.
 */
export async function requestTestnetNim(address: string, amountNim = 1000): Promise<FaucetResult> {
  try {
    const res = await fetch(FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ address: address.replace(/ /g, ""), amount: String(amountNim) }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || `Faucet request failed (${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Faucet request failed." };
  }
}
