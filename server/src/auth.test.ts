import { describe, expect, test } from "vitest";
import { bearerTokenMatches, computeBatchId } from "./auth.js";

describe("bearerTokenMatches", () => {
  test("matches a correct bearer token", () => {
    expect(bearerTokenMatches("Bearer secret123", "secret123")).toBe(true);
  });

  test("rejects a wrong token", () => {
    expect(bearerTokenMatches("Bearer wrong", "secret123")).toBe(false);
  });

  test("rejects a missing Authorization header", () => {
    expect(bearerTokenMatches(undefined, "secret123")).toBe(false);
  });

  test("rejects a header missing the Bearer prefix", () => {
    expect(bearerTokenMatches("secret123", "secret123")).toBe(false);
  });

  test("never matches when the expected token itself is unset - no accidental open auth", () => {
    expect(bearerTokenMatches("Bearer ", undefined)).toBe(false);
    expect(bearerTokenMatches("Bearer anything", "")).toBe(false);
  });
});

describe("computeBatchId", () => {
  test("is deterministic regardless of input payout order", () => {
    const a = [
      { deviceId: "x", payoutAddress: "NQ1", rank: 2, amountLuna: 100 },
      { deviceId: "y", payoutAddress: "NQ2", rank: 1, amountLuna: 200 },
    ];
    const b = [a[1], a[0]]; // same entries, reversed order
    expect(computeBatchId("window-1", a)).toBe(computeBatchId("window-1", b));
  });

  test("differs when the window differs", () => {
    const payouts = [{ deviceId: "x", payoutAddress: "NQ1", rank: 1, amountLuna: 100 }];
    expect(computeBatchId("window-1", payouts)).not.toBe(computeBatchId("window-2", payouts));
  });

  test("differs when any amount differs - catches a tampered/corrupted batch", () => {
    const base = [{ deviceId: "x", payoutAddress: "NQ1", rank: 1, amountLuna: 100 }];
    const tampered = [{ deviceId: "x", payoutAddress: "NQ1", rank: 1, amountLuna: 999 }];
    expect(computeBatchId("window-1", base)).not.toBe(computeBatchId("window-1", tampered));
  });
});
