import { describe, expect, test } from "vitest";
import { validateHandBody } from "./hands.js";

const VALID = {
  deviceId: "a".repeat(64),
  correctDecisions: 3,
  totalDecisions: 5,
  wagerLuna: 200_000,
  entryFeeTxHash: "b".repeat(64),
  payoutAddress: "NQ07 0000 0000 0000 0000 0000 0000 0000 0000",
};

describe("validateHandBody", () => {
  test("accepts a well-formed body", () => {
    expect(validateHandBody(VALID)).toEqual({ ok: true, value: VALID });
  });

  test("rejects a non-object body", () => {
    expect(validateHandBody("nope")).toEqual({ ok: false, error: expect.any(String) });
    expect(validateHandBody(null)).toEqual({ ok: false, error: expect.any(String) });
  });

  test("rejects a deviceId that isn't a 64-char identifier", () => {
    const result = validateHandBody({ ...VALID, deviceId: "too-short" });
    expect(result.ok).toBe(false);
  });

  test("rejects totalDecisions less than correctDecisions - a physically impossible hand", () => {
    const result = validateHandBody({ ...VALID, correctDecisions: 5, totalDecisions: 3 });
    expect(result.ok).toBe(false);
  });

  test("rejects a negative or zero wager", () => {
    expect(validateHandBody({ ...VALID, wagerLuna: 0 }).ok).toBe(false);
    expect(validateHandBody({ ...VALID, wagerLuna: -100 }).ok).toBe(false);
  });

  test("rejects a non-integer wager", () => {
    expect(validateHandBody({ ...VALID, wagerLuna: 1.5 }).ok).toBe(false);
  });

  test("rejects a tx hash that doesn't look like one", () => {
    expect(validateHandBody({ ...VALID, entryFeeTxHash: "not-a-hash" }).ok).toBe(false);
  });

  test("rejects a payout address that doesn't start with NQ", () => {
    expect(validateHandBody({ ...VALID, payoutAddress: "0x1234" }).ok).toBe(false);
  });
});
