import { describe, expect, test } from "vitest";
import { optimalAction } from "./strategy";

// Reference table for a hit/stand-only variant (no double/split available).
// Dealer upcard keys use 11 for Ace, matching optimalAction's own convention.
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

describe("optimalAction: hard totals", () => {
  test.each([4, 5, 6, 7, 8, 9, 10, 11])("hard %i always hits", (total) => {
    for (const up of UPCARDS) {
      expect(optimalAction(total, false, up), `hard ${total} vs ${up}`).toBe("hit");
    }
  });

  test("hard 12 stands only vs dealer 4-6", () => {
    const standVs = new Set([4, 5, 6]);
    for (const up of UPCARDS) {
      const expected = standVs.has(up) ? "stand" : "hit";
      expect(optimalAction(12, false, up), `hard 12 vs ${up}`).toBe(expected);
    }
  });

  test.each([13, 14, 15, 16])("hard %i stands vs dealer 2-6, hits vs 7-Ace", (total) => {
    const standVs = new Set([2, 3, 4, 5, 6]);
    for (const up of UPCARDS) {
      const expected = standVs.has(up) ? "stand" : "hit";
      expect(optimalAction(total, false, up), `hard ${total} vs ${up}`).toBe(expected);
    }
  });

  test.each([17, 18, 19, 20, 21])("hard %i always stands", (total) => {
    for (const up of UPCARDS) {
      expect(optimalAction(total, false, up), `hard ${total} vs ${up}`).toBe("stand");
    }
  });
});

describe("optimalAction: soft totals", () => {
  test.each([12, 13, 14, 15, 16, 17])("soft %i always hits (no double available)", (total) => {
    for (const up of UPCARDS) {
      expect(optimalAction(total, true, up), `soft ${total} vs ${up}`).toBe("hit");
    }
  });

  test("soft 18 hits only vs dealer 9, 10, or Ace", () => {
    const hitVs = new Set([9, 10, 11]);
    for (const up of UPCARDS) {
      const expected = hitVs.has(up) ? "hit" : "stand";
      expect(optimalAction(18, true, up), `soft 18 vs ${up}`).toBe(expected);
    }
  });

  test.each([19, 20, 21])("soft %i always stands", (total) => {
    for (const up of UPCARDS) {
      expect(optimalAction(total, true, up), `soft ${total} vs ${up}`).toBe("stand");
    }
  });
});

describe("optimalAction: dealer face cards and ace normalize correctly", () => {
  test("dealer J/Q/K (ranks 11-13) behave identically to a 10 upcard", () => {
    // The engine passes the raw card rank (1-13) as dealerUpcard; only rank 1
    // is special-cased as an ace. Ranks 11-13 must fall through the
    // `Math.min(dealerUpcard, 10)` clamp exactly like a plain 10.
    for (const rank of [10, 11, 12, 13]) {
      expect(optimalAction(15, false, rank)).toBe(optimalAction(15, false, 10));
    }
  });

  test("dealer ace (rank 1) is treated as high, not low", () => {
    // Hard 13 stands vs a weak dealer card but hits vs a strong one - an ace
    // must be graded as strong (like a 10-value upcard), not as rank "1".
    expect(optimalAction(13, false, 1)).toBe("hit");
  });
});
