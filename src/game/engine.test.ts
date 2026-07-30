import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import * as cardsModule from "./cards";
import type { Suit, PlayingCard } from "./cards";
import * as engine from "./engine";
import type { GameState } from "./engine";

vi.mock("./cards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cards")>();
  return { ...actual, drawCard: vi.fn(actual.drawCard) };
});

function card(rank: number, suit: Suit = "clubs"): PlayingCard {
  return { rank, suit };
}

function mockDraws(...cards: PlayingCard[]) {
  const mock = cardsModule.drawCard as unknown as Mock;
  mock.mockReset();
  for (const c of cards) mock.mockReturnValueOnce(c);
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...engine.initialState(), ...overrides };
}

beforeEach(() => {
  (cardsModule.drawCard as unknown as Mock).mockReset();
});

describe("initialState", () => {
  test("starts in betting phase with all counters at zero", () => {
    const s = engine.initialState();
    expect(s.phase).toBe("betting");
    expect(s.handsPlayed).toBe(0);
    expect(s.correctDecisions).toBe(0);
    expect(s.totalDecisions).toBe(0);
    expect(s.handDecisions).toEqual([]);
  });
});

describe("placeBet", () => {
  test("deals two cards each and moves to player-turn when no one has blackjack", () => {
    mockDraws(card(10), card(6), card(9), card(2)); // player 10,6=16; dealer 9,2=11
    const s = engine.placeBet(engine.initialState(), 2);
    expect(s.phase).toBe("player-turn");
    expect(s.wager).toBe(2);
    expect(s.playerHand).toEqual([card(10), card(6)]);
    expect(s.dealerHand).toEqual([card(9), card(2)]);
    expect(s.dealerHoleHidden).toBe(true);
  });

  test("player natural blackjack settles immediately as a win", () => {
    mockDraws(card(1), card(13), card(9), card(2)); // player A,K=21; dealer 9,2=11
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.phase).toBe("round-over");
    expect(s.outcome).toBe("win");
    expect(s.dealerHoleHidden).toBe(false);
    expect(s.handsPlayed).toBe(1);
  });

  test("both natural blackjack is a push, not a win for either side", () => {
    // Dealer up-card is Q (not an Ace) so this settles immediately via
    // placeBet instead of routing through the insurance phase.
    mockDraws(card(1), card(13), card(12), card(1)); // player A,K; dealer Q,A
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.outcome).toBe("push");
  });

  test("dealer natural blackjack (no player blackjack) settles as a loss", () => {
    // Dealer up-card is K (not an Ace) so this settles immediately via
    // placeBet instead of routing through the insurance phase.
    mockDraws(card(9), card(6), card(13), card(1)); // player 15; dealer K,A
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.outcome).toBe("lose");
  });
});

describe("hit", () => {
  test("records a graded decision and stays in player-turn if not bust", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(6)], // hard 16
      dealerHand: [card(9), card(2)],
      dealerHoleHidden: true,
    });
    mockDraws(card(3)); // 16 + 3 = 19, no bust
    const next = engine.hit(s);
    expect(next.phase).toBe("player-turn");
    expect(next.handDecisions).toHaveLength(1);
    // Hard 16 vs dealer 9 on a fresh 2-card hand: surrender is now a real,
    // available option (Task 2), and basic strategy prefers it over hitting.
    expect(next.handDecisions[0]).toMatchObject({
      total: 16,
      dealerUpcard: 9,
      action: "hit",
      optimal: "surrender",
      wasCorrect: false,
    });
  });

  test("busting settles immediately as a loss and reveals the dealer hole card", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(6)], // hard 16
      dealerHand: [card(9), card(2)],
      dealerHoleHidden: true,
    });
    mockDraws(card(10)); // 16 + 10 = 26, bust
    const next = engine.hit(s);
    expect(next.phase).toBe("round-over");
    expect(next.outcome).toBe("lose");
    expect(next.dealerHoleHidden).toBe(false);
  });

  test("grades an incorrect hit as incorrect even though the card looks great", () => {
    // Hard 17 should stand. Hitting here is a strategy mistake regardless of
    // what happens to come next - the grade must reflect the decision, not
    // its lucky outcome.
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(7)], // hard 17
      dealerHand: [card(6), card(2)],
      dealerHoleHidden: true,
    });
    mockDraws(card(4)); // 17 + 4 = 21
    const next = engine.hit(s);
    expect(next.handDecisions[0]).toMatchObject({ action: "hit", optimal: "stand", wasCorrect: false });
  });
});

describe("stand", () => {
  test("dealer stands on all 17s, including soft 17 - no extra draw", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(8)], // 18
      dealerHand: [card(1), card(6)], // soft 17 (A,6)
      dealerHoleHidden: true,
    });
    const next = engine.stand(s);
    expect(next.dealerHand).toEqual([card(1), card(6)]);
    expect(next.outcome).toBe("win");
  });

  test("dealer hits below 17 until standing or busting", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(9)], // 19
      dealerHand: [card(5), card(4)], // 9, must hit
      dealerHoleHidden: true,
    });
    mockDraws(card(6), card(6)); // 9 -> 15 -> 21
    const next = engine.stand(s);
    expect(next.dealerHand.map((c) => c.rank)).toEqual([5, 4, 6, 6]);
    expect(next.outcome).toBe("lose"); // dealer's 21 beats player's 19
  });
});

describe("compliance: skill-score is independent of hand outcome and wager", () => {
  test("wager amount never influences win/lose/push", () => {
    const shared = {
      phase: "player-turn" as const,
      playerHand: [card(10), card(8)],
      dealerHand: [card(10), card(6)],
      dealerHoleHidden: true,
    };
    mockDraws(card(9)); // dealer 16 -> hits -> 25 bust
    const cheap = engine.stand(baseState({ ...shared, wager: 1 }));
    mockDraws(card(9));
    const expensive = engine.stand(baseState({ ...shared, wager: 5 }));
    expect(cheap.outcome).toBe(expensive.outcome);
  });

  test("a correct decision that still loses the hand is scored as correct", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(10), card(7)], // hard 17: optimal is stand
      dealerHand: [card(6), card(5)], // dealer 11, must hit
      dealerHoleHidden: true,
      wager: 5,
    });
    mockDraws(card(10)); // dealer 11 -> 21, beats player's 17
    const next = engine.stand(s); // standing on hard 17 is objectively correct
    expect(next.outcome).toBe("lose");
    expect(next.correctDecisions).toBe(1);
    expect(next.totalDecisions).toBe(1);
  });

  test("an incorrect decision that happens to win the hand is not scored as correct", () => {
    const s = baseState({
      phase: "player-turn",
      playerHand: [card(7), card(5)], // hard 12 vs dealer 3: optimal is hit, not stand
      dealerHand: [card(3), card(9)], // dealer 12, must hit
      dealerHoleHidden: true,
    });
    mockDraws(card(13)); // dealer 12 -> 22, bust
    const next = engine.stand(s); // wrong call: should have hit on 12 vs 3
    expect(next.outcome).toBe("win");
    expect(next.correctDecisions).toBe(0);
    expect(next.totalDecisions).toBe(1);
  });
});

describe("nextHand", () => {
  test("resets per-hand state but preserves cumulative counters", () => {
    const played = baseState({
      phase: "round-over",
      handsPlayed: 3,
      correctDecisions: 2,
      totalDecisions: 4,
      wager: 5,
      playerHand: [card(10), card(8)],
    });
    const next = engine.nextHand(played);
    expect(next.phase).toBe("betting");
    expect(next.playerHand).toEqual([]);
    expect(next.wager).toBe(0);
    expect(next.handsPlayed).toBe(3);
    expect(next.correctDecisions).toBe(2);
    expect(next.totalDecisions).toBe(4);
  });
});

describe("canDoubleOrSurrender", () => {
  test("true on a fresh 2-card hand in player-turn", () => {
    const s = baseState({ phase: "player-turn", playerHand: [card(5), card(6)], dealerHand: [card(9), card(2)] });
    expect(engine.canDoubleOrSurrender(s)).toBe(true);
  });

  test("false once the player has already hit", () => {
    const s = baseState({ phase: "player-turn", playerHand: [card(5), card(6), card(2)], dealerHand: [card(9), card(2)] });
    expect(engine.canDoubleOrSurrender(s)).toBe(false);
  });

  test("false outside player-turn", () => {
    const s = baseState({ phase: "betting", playerHand: [card(5), card(6)], dealerHand: [card(9), card(2)] });
    expect(engine.canDoubleOrSurrender(s)).toBe(false);
  });
});

describe("double", () => {
  test("draws exactly one card, records a graded decision, and stands automatically when not bust", () => {
    mockDraws(card(6)); // player draws a 6: 5+6+6 = 17
    const s = baseState({ phase: "player-turn", playerHand: [card(5), card(6)], dealerHand: [card(9), card(2)], dealerHoleHidden: true });
    const next = engine.double(s);
    expect(next.playerHand).toEqual([card(5), card(6), card(6)]);
    expect(next.handDecisions).toHaveLength(1);
    expect(next.handDecisions[0].action).toBe("double");
    expect(next.phase).toBe("round-over"); // dealer (9,2=11) draws to beat/lose to player's 17, either way turn is over
    expect(next.dealerHoleHidden).toBe(false);
  });

  test("busting on the double card ends the hand as a loss", () => {
    mockDraws(card(10)); // player: 10,6,10 = 26, bust
    const s = baseState({ phase: "player-turn", playerHand: [card(10), card(6)], dealerHand: [card(9), card(2)], dealerHoleHidden: true });
    const next = engine.double(s);
    expect(next.phase).toBe("round-over");
    expect(next.outcome).toBe("lose");
    expect(next.dealerHoleHidden).toBe(false);
  });

  test("grades the double as correct when it matches basic strategy", () => {
    // hard 11 vs dealer 6 - basic strategy says double
    mockDraws(card(5));
    const s = baseState({ phase: "player-turn", playerHand: [card(5), card(6)], dealerHand: [card(6), card(2)], dealerHoleHidden: true });
    const next = engine.double(s);
    expect(next.handDecisions[0].wasCorrect).toBe(true);
  });
});

describe("surrender", () => {
  test("ends the hand immediately with a distinct surrender outcome", () => {
    const s = baseState({ phase: "player-turn", playerHand: [card(10), card(6)], dealerHand: [card(10), card(6)], dealerHoleHidden: true });
    const next = engine.surrender(s);
    expect(next.phase).toBe("round-over");
    expect(next.outcome).toBe("surrender");
    expect(next.dealerHoleHidden).toBe(false);
    expect(next.handsPlayed).toBe(1);
  });

  test("records a graded decision - correct when basic strategy actually says surrender", () => {
    // hard 16 vs dealer 10 - basic strategy says surrender
    const s = baseState({ phase: "player-turn", playerHand: [card(10), card(6)], dealerHand: [card(10), card(6)], dealerHoleHidden: true });
    const next = engine.surrender(s);
    expect(next.handDecisions).toHaveLength(1);
    expect(next.handDecisions[0].action).toBe("surrender");
    expect(next.handDecisions[0].wasCorrect).toBe(true);
  });

  test("records surrender as incorrect when basic strategy says something else", () => {
    // hard 17 vs dealer 6 - basic strategy says stand, never surrender
    const s = baseState({ phase: "player-turn", playerHand: [card(10), card(7)], dealerHand: [card(6), card(2)], dealerHoleHidden: true });
    const next = engine.surrender(s);
    expect(next.handDecisions[0].wasCorrect).toBe(false);
  });

  test("does not draw any cards", () => {
    const s = baseState({ phase: "player-turn", playerHand: [card(10), card(6)], dealerHand: [card(10), card(6)], dealerHoleHidden: true });
    const next = engine.surrender(s);
    expect(next.playerHand).toEqual([card(10), card(6)]);
    expect(next.dealerHand).toEqual([card(10), card(6)]);
  });
});

describe("placeBet: insurance offer", () => {
  test("offers insurance when the dealer's up-card is an Ace, before checking for blackjack", () => {
    mockDraws(card(10), card(6), card(1), card(9)); // dealer shows Ace first
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.phase).toBe("insurance");
    expect(s.insuranceDecision).toBeNull();
    expect(s.dealerHoleHidden).toBe(true); // hole card still hidden - blackjack hasn't been checked yet
  });

  test("does not offer insurance when the dealer's up-card is not an Ace", () => {
    mockDraws(card(10), card(6), card(9), card(2));
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.phase).toBe("player-turn");
  });
});

describe("declineInsurance", () => {
  test("grades declining as correct and moves to player-turn when no one has blackjack", () => {
    const s = baseState({
      phase: "insurance",
      playerHand: [card(10), card(6)],
      dealerHand: [card(1), card(9)],
      dealerHoleHidden: true,
      insuranceDecision: null,
    });
    const next = engine.declineInsurance(s);
    expect(next.insuranceDecision).toBe("declined");
    expect(next.correctDecisions).toBe(1);
    expect(next.totalDecisions).toBe(1);
    expect(next.phase).toBe("player-turn");
  });

  test("settles immediately as a loss if the dealer actually has blackjack", () => {
    mockDraws(); // no more draws expected
    const s = baseState({
      phase: "insurance",
      playerHand: [card(10), card(6)],
      dealerHand: [card(1), card(13)], // dealer A,K = blackjack
      dealerHoleHidden: true,
      insuranceDecision: null,
    });
    const next = engine.declineInsurance(s);
    expect(next.phase).toBe("round-over");
    expect(next.outcome).toBe("lose");
    expect(next.dealerHoleHidden).toBe(false);
  });

  test("settles as a push if both the dealer and player have blackjack", () => {
    const s = baseState({
      phase: "insurance",
      playerHand: [card(1), card(11)], // player A,J = blackjack
      dealerHand: [card(1), card(13)], // dealer A,K = blackjack
      dealerHoleHidden: true,
      insuranceDecision: null,
    });
    const next = engine.declineInsurance(s);
    expect(next.outcome).toBe("push");
  });
});

describe("takeInsurance", () => {
  test("grades taking insurance as incorrect", () => {
    const s = baseState({
      phase: "insurance",
      playerHand: [card(10), card(6)],
      dealerHand: [card(1), card(9)],
      dealerHoleHidden: true,
      insuranceDecision: null,
    });
    const next = engine.takeInsurance(s);
    expect(next.insuranceDecision).toBe("taken");
    expect(next.correctDecisions).toBe(0);
    expect(next.totalDecisions).toBe(1);
    expect(next.phase).toBe("player-turn");
  });
});
