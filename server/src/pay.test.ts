import { afterEach, describe, expect, test, vi } from "vitest";
import { findIncomingPayment, TREASURY_ADDRESS } from "./pay.js";

function mockExplorerResponse(txs: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => txs }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const RECIPIENT_STRIPPED = TREASURY_ADDRESS.replace(/ /g, "");
const NOW = 1_700_000_000_000;

describe("findIncomingPayment", () => {
  test("returns null when no transaction matches the recipient at all", async () => {
    mockExplorerResponse([
      { hash: "abc", receiver_address: "NQ00 OTHER", value: 100_000, data: "sharp21#abc123", timestamp: NOW / 1000 },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toBeNull();
  });

  test("returns null when recipient and amount match but the nonce is missing - amount+recipient alone is never enough", async () => {
    mockExplorerResponse([
      { hash: "abc", receiver_address: RECIPIENT_STRIPPED, value: 100_000, data: "", timestamp: NOW / 1000 },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toBeNull();
  });

  test("returns null when recipient and amount match but the nonce belongs to a DIFFERENT player's bet", async () => {
    // The exact collision this whole nonce scheme exists to prevent: two
    // players betting the identical amount to the identical treasury
    // address in the same window.
    mockExplorerResponse([
      {
        hash: "abc",
        receiver_address: RECIPIENT_STRIPPED,
        value: 100_000,
        data: "sharp21#zzz999",
        sender_address: "NQ00 SOMEONE ELSE",
        timestamp: NOW / 1000,
      },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toBeNull();
  });

  test("matches when recipient, amount, and nonce all line up", async () => {
    mockExplorerResponse([
      {
        hash: "the-real-hash",
        receiver_address: RECIPIENT_STRIPPED,
        value: 100_000,
        data: "sharp21#abc123",
        sender_address: "NQ01 PLAYER ADDRESS",
        timestamp: NOW / 1000,
      },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toEqual({ txHash: "the-real-hash", senderAddress: "NQ01 PLAYER ADDRESS" });
  });

  test("decodes a hex-encoded on-chain message before checking for the nonce", async () => {
    const hexMessage = Buffer.from("sharp21#abc123", "utf8").toString("hex");
    mockExplorerResponse([
      {
        hash: "hex-hash",
        receiver_address: RECIPIENT_STRIPPED,
        value: 100_000,
        data: hexMessage,
        sender_address: "NQ01 PLAYER ADDRESS",
        timestamp: NOW / 1000,
      },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result?.txHash).toBe("hex-hash");
  });

  test("rejects a transaction older than the freshness window (beyond clock-skew tolerance)", async () => {
    mockExplorerResponse([
      {
        hash: "stale-hash",
        receiver_address: RECIPIENT_STRIPPED,
        value: 100_000,
        data: "sharp21#abc123",
        sender_address: "NQ01 PLAYER ADDRESS",
        timestamp: (NOW - 10 * 60_000) / 1000, // 10 minutes before the QR was shown
      },
    ]);
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toBeNull();
  });

  test("returns null (not a thrown error) when the explorer is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await findIncomingPayment({ treasuryAddress: TREASURY_ADDRESS, amountLuna: 100_000, nonce: "abc123", sinceMs: NOW });
    expect(result).toBeNull();
  });
});
