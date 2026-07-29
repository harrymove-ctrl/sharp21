import { beforeEach, describe, expect, test, vi } from "vitest";
import { getHostLanguage, init } from "@nimiq/mini-app-sdk";
import { getConnectedAccount, isNetworkReady, isNimiqPayHost, payEntryFee } from "./client";

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

describe("getConnectedAccount", () => {
  test("returns the first account when the wallet resolves a non-empty list", async () => {
    const listAccounts = vi.fn().mockResolvedValue([REAL_ADDRESS, "NQ07 1111 1111 1111 1111 1111 1111 1111 1111"]);
    vi.mocked(init).mockResolvedValue({ listAccounts } as never);

    expect(await getConnectedAccount()).toBe(REAL_ADDRESS);
  });

  test("returns null when the wallet resolves an ErrorResponse instead of a list", async () => {
    const listAccounts = vi.fn().mockResolvedValue({ error: { type: "denied", message: "no" } });
    vi.mocked(init).mockResolvedValue({ listAccounts } as never);

    expect(await getConnectedAccount()).toBeNull();
  });

  test("returns null when the wallet resolves an empty list", async () => {
    const listAccounts = vi.fn().mockResolvedValue([]);
    vi.mocked(init).mockResolvedValue({ listAccounts } as never);

    expect(await getConnectedAccount()).toBeNull();
  });

  test("returns null, not a thrown error, when the request fails outright", async () => {
    vi.mocked(init).mockRejectedValue(new Error("PermissionDeniedError"));

    expect(await getConnectedAccount()).toBeNull();
  });
});

describe("isNetworkReady", () => {
  test("reflects the provider's consensus state", async () => {
    const isConsensusEstablished = vi.fn().mockResolvedValue(true);
    vi.mocked(init).mockResolvedValue({ isConsensusEstablished } as never);

    expect(await isNetworkReady()).toBe(true);
  });

  test("is false, not a thrown error, when the request fails outright", async () => {
    vi.mocked(init).mockRejectedValue(new Error("timeout"));

    expect(await isNetworkReady()).toBe(false);
  });
});
