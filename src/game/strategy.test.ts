import { describe, expect, test } from "vitest";
import { optimalAction } from "./strategy";

// Dealer upcard keys use 1 for Ace (rank 1), matching optimalAction's own convention.
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];

function expectByUpcard(
  total: number,
  isSoft: boolean,
  canDouble: boolean,
  canSurrender: boolean,
  expected: Record<number, string>,
) {
  for (const up of UPCARDS) {
    expect(optimalAction(total, isSoft, up, canDouble, canSurrender), `total ${total} vs ${up}`).toBe(expected[up]);
  }
}

describe("optimalAction: hard totals, no double/surrender available", () => {
  test.each([4, 5, 6, 7, 8])("hard %i always hits", (total) => {
    expectByUpcard(total, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("hard 9 hits everywhere when double isn't available", () => {
    expectByUpcard(9, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("hard 10 hits everywhere when double isn't available", () => {
    expectByUpcard(10, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("hard 11 hits everywhere when double isn't available", () => {
    expectByUpcard(11, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("hard 12 stands only vs dealer 4-6", () => {
    expectByUpcard(12, false, false, false, { 2: "hit", 3: "hit", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test.each([13, 14])("hard %i stands vs dealer 2-6, hits vs 7-Ace", (total) => {
    expectByUpcard(total, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("hard 15 hits vs 7-Ace when surrender isn't available (would surrender vs 10 if it were)", () => {
    expectByUpcard(15, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("hard 16 hits vs 9/10/Ace when surrender isn't available", () => {
    expectByUpcard(16, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test.each([17, 18, 19, 20, 21])("hard %i always stands", (total) => {
    expectByUpcard(total, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "stand"])));
  });
});

describe("optimalAction: hard totals, double and surrender available", () => {
  test("hard 9 doubles vs dealer 3-6, else hits", () => {
    expectByUpcard(9, false, true, false, { 2: "hit", 3: "double", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("hard 10 doubles vs dealer 2-9, hits vs 10/Ace", () => {
    expectByUpcard(10, false, true, false, { 2: "double", 3: "double", 4: "double", 5: "double", 6: "double", 7: "double", 8: "double", 9: "double", 10: "hit", 1: "hit" });
  });

  test("hard 11 doubles vs dealer 2-10, hits vs Ace", () => {
    expectByUpcard(11, false, true, false, { 2: "double", 3: "double", 4: "double", 5: "double", 6: "double", 7: "double", 8: "double", 9: "double", 10: "double", 1: "hit" });
  });

  test("hard 15 surrenders vs dealer 10 when surrender is available, unaffected by canDouble", () => {
    expectByUpcard(15, false, true, true, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "surrender", 1: "hit" });
  });

  test("hard 16 surrenders vs dealer 9, 10, and Ace when surrender is available", () => {
    expectByUpcard(16, false, false, true, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "surrender", 10: "surrender", 1: "surrender" });
  });
});

describe("optimalAction: soft totals, no double available", () => {
  test("soft 12 (A,A before any split) always hits", () => {
    expectByUpcard(12, true, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test.each([13, 14, 15, 16, 17])("soft %i always hits when double isn't available", (total) => {
    expectByUpcard(total, true, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("soft 18 hits only vs dealer 9, 10, or Ace when double isn't available", () => {
    expectByUpcard(18, true, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "stand", 8: "stand", 9: "hit", 10: "hit", 1: "hit" });
  });

  test.each([19, 20, 21])("soft %i always stands", (total) => {
    expectByUpcard(total, true, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "stand"])));
  });
});

describe("optimalAction: soft totals, double available", () => {
  test("soft 12 (A,A before any split) always hits, even when double is available", () => {
    expectByUpcard(12, true, true, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("soft 13 (A2) doubles vs dealer 5-6, else hits", () => {
    expectByUpcard(13, true, true, false, { 2: "hit", 3: "hit", 4: "hit", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("soft 14 (A3) doubles vs dealer 5-6, else hits", () => {
    expectByUpcard(14, true, true, false, { 2: "hit", 3: "hit", 4: "hit", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("soft 15 (A4) doubles vs dealer 4-6, else hits", () => {
    expectByUpcard(15, true, true, false, { 2: "hit", 3: "hit", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("soft 16 (A5) doubles vs dealer 4-6, else hits", () => {
    expectByUpcard(16, true, true, false, { 2: "hit", 3: "hit", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("soft 17 (A6) doubles vs dealer 3-6, else hits", () => {
    expectByUpcard(17, true, true, false, { 2: "hit", 3: "double", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 1: "hit" });
  });

  test("soft 18 (A7) doubles vs dealer 3-6, stands vs 2/7/8, hits vs 9/10/Ace", () => {
    expectByUpcard(18, true, true, false, { 2: "stand", 3: "double", 4: "double", 5: "double", 6: "double", 7: "stand", 8: "stand", 9: "hit", 10: "hit", 1: "hit" });
  });
});

describe("optimalAction: dealer face cards normalize like ten, ace normalizes high", () => {
  test("dealer J/Q/K behave exactly like dealer 10", () => {
    for (const face of [11, 12, 13]) {
      expect(optimalAction(16, false, face, false, false)).toBe(optimalAction(16, false, 10, false, false));
    }
  });

  test("dealer showing Ace (rank 1) behaves like upcard 11 in the tables above", () => {
    expect(optimalAction(11, false, 1, true, false)).toBe("hit");
    expect(optimalAction(16, false, 1, false, true)).toBe("surrender");
  });
});
