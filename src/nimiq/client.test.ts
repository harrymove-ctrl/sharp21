import { beforeEach, describe, expect, test, vi } from "vitest";
import { getHostLanguage, init } from "@nimiq/mini-app-sdk";
import { isNimiqPayHost, payEntryFee } from "./client";

vi.mock("@nimiq/mini-app-sdk", () => ({
  init: vi.fn(),
  getHostLanguage: vi.fn(),
  requestDeviceIdentifier: vi.fn(async () => "deadbeef"),
}));

const REAL_ADDRESS = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";

beforeEach(() => {
  vi.mocked(init).mockReset();
  vi.mocked(getHostLanguage).mockReset();
});

describe("isNimiqPayHost", () => {
  test("false outside Nimiq Pay, where getHostLanguage has nothing to return", () => {
    vi.mocked(getHostLanguage).mockReturnValue(undefined);
    expect(isNimiqPayHost()).toBe(false);
  });

  test("true inside Nimiq Pay, where getHostLanguage resolves a language code", () => {
    vi.mocked(getHostLanguage).mockReturnValue("en");
    expect(isNimiqPayHost()).toBe(true);
  });
});

describe("payEntryFee", () => {
  test("refuses to pay when no treasury address is configured", async () => {
    const result = await payEntryFee(1, "");
    expect(result).toEqual({ ok: false, message: expect.stringContaining("treasury") });
    expect(init).not.toHaveBeenCalled();
  });

  test("refuses to pay while the address is still the unfilled placeholder", async () => {
    const result = await payEntryFee(1, "REPLACE_WITH_REAL_TREASURY_NIM_ADDRESS");
    expect(result.ok).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  test("converts NIM to Luna and requests the transaction from the wallet", async () => {
    const sendBasicTransaction = vi.fn().mockResolvedValue("txhash123");
    vi.mocked(init).mockResolvedValue({ sendBasicTransaction } as never);

    const result = await payEntryFee(2, REAL_ADDRESS);

    expect(sendBasicTransaction).toHaveBeenCalledWith({ recipient: REAL_ADDRESS, value: 200_000 });
    expect(result).toEqual({ ok: true, txHash: "txhash123" });
  });

  test("surfaces a wallet-level ErrorResponse as a failed result, not a thrown error", async () => {
    const sendBasicTransaction = vi.fn().mockResolvedValue({ error: { type: "insufficient_funds", message: "Not enough NIM" } });
    vi.mocked(init).mockResolvedValue({ sendBasicTransaction } as never);

    const result = await payEntryFee(5, REAL_ADDRESS);

    expect(result).toEqual({ ok: false, message: "Not enough NIM" });
  });

  test("surfaces a rejected/thrown wallet request (e.g. user declined) as a failed result", async () => {
    vi.mocked(init).mockRejectedValue(new Error("User rejected the request"));

    const result = await payEntryFee(1, REAL_ADDRESS);

    expect(result).toEqual({ ok: false, message: "User rejected the request" });
  });
});
