import { describe, expect, test } from "vitest";
import { cardValue, drawCard, handValue, isRed, rankLabel, suitGlyph } from "./cards";

describe("cardValue", () => {
  test("ace counts as 11 before any bust reduction", () => {
    expect(cardValue(1)).toBe(11);
  });

  test.each([10, 11, 12, 13])("rank %i (10/J/Q/K) counts as 10", (rank) => {
    expect(cardValue(rank)).toBe(10);
  });

  test.each([2, 3, 4, 5, 6, 7, 8, 9])("rank %i counts as its own pip value", (rank) => {
    expect(cardValue(rank)).toBe(rank);
  });
});

describe("handValue", () => {
  test("plain hard total with no aces", () => {
    const hv = handValue([
      { rank: 9, suit: "clubs" },
      { rank: 7, suit: "spades" },
    ]);
    expect(hv).toMatchObject({ total: 16, isSoft: false, isBust: false, isBlackjack: false });
  });

  test("ace counts as 11 when it doesn't bust", () => {
    const hv = handValue([
      { rank: 1, suit: "hearts" },
      { rank: 6, suit: "spades" },
    ]);
    expect(hv).toMatchObject({ total: 17, isSoft: true });
  });

  test("ace reduces to 1 the moment it would otherwise bust", () => {
    const hv = handValue([
      { rank: 1, suit: "hearts" },
      { rank: 6, suit: "spades" },
      { rank: 9, suit: "clubs" },
    ]);
    // 11 + 6 + 9 = 26 -> reduce one ace by 10 -> 16, no longer soft
    expect(hv).toMatchObject({ total: 16, isSoft: false, isBust: false });
  });

  test("two aces: one stays soft (11 + 1), not both reduced", () => {
    const hv = handValue([
      { rank: 1, suit: "hearts" },
      { rank: 1, suit: "spades" },
    ]);
    expect(hv).toMatchObject({ total: 12, isSoft: true });
  });

  test("two aces plus a ten: both aces must reduce to stay <= 21", () => {
    const hv = handValue([
      { rank: 1, suit: "hearts" },
      { rank: 1, suit: "spades" },
      { rank: 10, suit: "clubs" },
    ]);
    // 11 + 11 + 10 = 32 -> reduce both aces -> 12, no soft ace left
    expect(hv).toMatchObject({ total: 12, isSoft: false });
  });

  test("bust when total exceeds 21 with no ace left to reduce", () => {
    const hv = handValue([
      { rank: 10, suit: "hearts" },
      { rank: 9, suit: "spades" },
      { rank: 5, suit: "clubs" },
    ]);
    expect(hv).toMatchObject({ total: 24, isBust: true });
  });

  test("natural blackjack: exactly 21 on the first two cards", () => {
    const hv = handValue([
      { rank: 1, suit: "hearts" },
      { rank: 13, suit: "spades" },
    ]);
    expect(hv).toMatchObject({ total: 21, isBlackjack: true });
  });

  test("21 built from three or more cards is not a natural blackjack", () => {
    const hv = handValue([
      { rank: 7, suit: "hearts" },
      { rank: 7, suit: "spades" },
      { rank: 7, suit: "clubs" },
    ]);
    expect(hv).toMatchObject({ total: 21, isBlackjack: false });
  });

  test("empty hand is a well-defined zero, not soft, not bust", () => {
    expect(handValue([])).toMatchObject({ total: 0, isSoft: false, isBust: false, isBlackjack: false });
  });
});

describe("display helpers", () => {
  test("rankLabel maps face cards and ace to letters, numbers stay numeric", () => {
    expect(rankLabel(1)).toBe("A");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(12)).toBe("Q");
    expect(rankLabel(13)).toBe("K");
    expect(rankLabel(7)).toBe("7");
  });

  test("isRed is true only for diamonds and hearts", () => {
    expect(isRed("diamonds")).toBe(true);
    expect(isRed("hearts")).toBe(true);
    expect(isRed("clubs")).toBe(false);
    expect(isRed("spades")).toBe(false);
  });

  test("suitGlyph returns a distinct glyph per suit", () => {
    const glyphs = new Set((["clubs", "diamonds", "hearts", "spades"] as const).map(suitGlyph));
    expect(glyphs.size).toBe(4);
  });
});

describe("drawCard", () => {
  test("always produces a rank in [1, 13] and a valid suit", () => {
    const suits = new Set(["clubs", "diamonds", "hearts", "spades"]);
    for (let i = 0; i < 200; i++) {
      const card = drawCard();
      expect(card.rank).toBeGreaterThanOrEqual(1);
      expect(card.rank).toBeLessThanOrEqual(13);
      expect(suits.has(card.suit)).toBe(true);
    }
  });
});
