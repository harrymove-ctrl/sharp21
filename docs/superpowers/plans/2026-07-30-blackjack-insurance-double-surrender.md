# Insurance, Double Down & Surrender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three real basic-strategy decisions Sharp21 is currently missing — insurance, double down, and surrender — so the game grades players against the *actual* full basic strategy chart instead of a deliberately hit/stand-only subset, without changing anything about how real-money entry fees or payouts work.

**Architecture:** Extend `strategy.ts`'s `optimalAction` to know about doubling and surrender (two new boolean inputs, two new possible return values). Extend `engine.ts` with three new pure state-transition functions (`double`, `surrender`, `takeInsurance`/`declineInsurance`) and a new `"insurance"` phase, reusing the existing `handDecisions`/`settle` bookkeeping wherever possible instead of duplicating it. Extend `useBlackjack.ts` and the UI (`Hud.tsx`, `Table.tsx`) to expose the new actions and correctly report the extra graded decisions to the backend leaderboard.

**Tech Stack:** TypeScript, Vitest (existing conventions in `src/game/*.test.ts`), React 19.

## Global Constraints

- Sharp21 does not simulate real casino payouts anywhere on the client (win/lose/push is a cosmetic outcome message only — the actual NIM entry fee is a fixed, one-time on-chain payment already made before the hand starts; no code path collects a *second* payment mid-hand). Every new action in this plan must therefore be a **skill-graded decision only** — never attempt to "double the wager" or "get half the wager back" as a real transaction. Say so in code comments where it would otherwise look like an oversight.
- Basic strategy values in this plan are taken from the verified "Multi-Deck, Dealer Stands Soft 17, Double after Split" chart (matches Sharp21's actual rules: `engine.ts`'s dealer-draw loop is `while (total < 17) hit`, i.e. stands on soft 17; `cards.ts`'s `drawCard()` is infinite-deck-with-replacement, i.e. no penetration/counting effects to model). Do not substitute a hit-soft-17 or single-deck chart.
- `dealerUpcard` follows the existing convention throughout the codebase: raw card rank 1–13, with 1 meaning Ace. `optimalAction` internally normalizes this the same way it already does (`dealerUpcard === 1 ? 11 : Math.min(dealerUpcard, 10)`) — keep using that exact expression, don't invent a new normalization.
- Every new engine function must be a pure function of `GameState -> GameState`, matching every existing function in `engine.ts` (`hit`, `stand`, `placeBet`, etc.) — no side effects, no async.

---

### Task 1: Extend `optimalAction` with double-down and surrender

**Files:**
- Modify: `src/game/strategy.ts`
- Test: `src/game/strategy.test.ts` (full rewrite — the existing file assumes a hit/stand-only 3-arg signature that no longer exists)

**Interfaces:**
- Produces: `export type Action = "hit" | "stand" | "double" | "surrender";` and `export function optimalAction(total: number, isSoft: boolean, dealerUpcard: number, canDouble: boolean, canSurrender: boolean): Action` — Task 2 and later tasks call this with `canDouble`/`canSurrender` derived from `GameState`.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/game/strategy.test.ts` with:

```typescript
import { describe, expect, test } from "vitest";
import { optimalAction } from "./strategy";

// Dealer upcard keys use 11 for Ace, matching optimalAction's own convention.
const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
    expectByUpcard(12, false, false, false, { 2: "hit", 3: "hit", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test.each([13, 14])("hard %i stands vs dealer 2-6, hits vs 7-Ace", (total) => {
    expectByUpcard(total, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("hard 15 hits vs 7-Ace when surrender isn't available (would surrender vs 10 if it were)", () => {
    expectByUpcard(15, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("hard 16 hits vs 9/10/Ace when surrender isn't available", () => {
    expectByUpcard(16, false, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test.each([17, 18, 19, 20, 21])("hard %i always stands", (total) => {
    expectByUpcard(total, false, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "stand"])));
  });
});

describe("optimalAction: hard totals, double and surrender available", () => {
  test("hard 9 doubles vs dealer 3-6, else hits", () => {
    expectByUpcard(9, false, true, false, { 2: "hit", 3: "double", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("hard 10 doubles vs dealer 2-9, hits vs 10/Ace", () => {
    expectByUpcard(10, false, true, false, { 2: "double", 3: "double", 4: "double", 5: "double", 6: "double", 7: "double", 8: "double", 9: "double", 10: "hit", 11: "hit" });
  });

  test("hard 11 doubles vs dealer 2-10, hits vs Ace", () => {
    expectByUpcard(11, false, true, false, { 2: "double", 3: "double", 4: "double", 5: "double", 6: "double", 7: "double", 8: "double", 9: "double", 10: "double", 11: "hit" });
  });

  test("hard 15 surrenders vs dealer 10 when surrender is available, unaffected by canDouble", () => {
    expectByUpcard(15, false, true, true, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "hit", 10: "surrender", 11: "hit" });
  });

  test("hard 16 surrenders vs dealer 9, 10, and Ace when surrender is available", () => {
    expectByUpcard(16, false, false, true, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "hit", 8: "hit", 9: "surrender", 10: "surrender", 11: "surrender" });
  });
});

describe("optimalAction: soft totals, no double available", () => {
  test.each([13, 14, 15, 16, 17])("soft %i always hits when double isn't available", (total) => {
    expectByUpcard(total, true, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "hit"])));
  });

  test("soft 18 hits only vs dealer 9, 10, or Ace when double isn't available", () => {
    expectByUpcard(18, true, false, false, { 2: "stand", 3: "stand", 4: "stand", 5: "stand", 6: "stand", 7: "stand", 8: "stand", 9: "hit", 10: "hit", 11: "hit" });
  });

  test.each([19, 20, 21])("soft %i always stands", (total) => {
    expectByUpcard(total, true, false, false, Object.fromEntries(UPCARDS.map((u) => [u, "stand"])));
  });
});

describe("optimalAction: soft totals, double available", () => {
  test("soft 13 (A2) doubles vs dealer 5-6, else hits", () => {
    expectByUpcard(13, true, true, false, { 2: "hit", 3: "hit", 4: "hit", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("soft 14 (A3) doubles vs dealer 5-6, else hits", () => {
    expectByUpcard(14, true, true, false, { 2: "hit", 3: "hit", 4: "hit", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("soft 15 (A4) doubles vs dealer 4-6, else hits", () => {
    expectByUpcard(15, true, true, false, { 2: "hit", 3: "hit", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("soft 16 (A5) doubles vs dealer 4-6, else hits", () => {
    expectByUpcard(16, true, true, false, { 2: "hit", 3: "hit", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("soft 17 (A6) doubles vs dealer 3-6, else hits", () => {
    expectByUpcard(17, true, true, false, { 2: "hit", 3: "double", 4: "double", 5: "double", 6: "double", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("soft 18 (A7) doubles vs dealer 3-6, stands vs 2/7/8, hits vs 9/10/Ace", () => {
    expectByUpcard(18, true, true, false, { 2: "stand", 3: "double", 4: "double", 5: "double", 6: "double", 7: "stand", 8: "stand", 9: "hit", 10: "hit", 11: "hit" });
  });
});

describe("optimalAction: dealer face cards normalize like ten, ace normalizes high", () => {
  test("dealer J/Q/K behave exactly like dealer 10", () => {
    for (const face of [11, 12, 13]) {
      expect(optimalAction(16, false, false, false, face)).toBe(optimalAction(16, false, false, false, 10));
    }
  });

  test("dealer showing Ace (rank 1) behaves like upcard 11 in the tables above", () => {
    expect(optimalAction(11, false, true, false, 1)).toBe("hit");
    expect(optimalAction(16, false, false, true, 1)).toBe("surrender");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/strategy.test.ts`
Expected: FAIL — `optimalAction` still has the old 3-argument signature, so most calls above are a type/argument-count mismatch and every assertion fails.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/game/strategy.ts` with:

```typescript
export type Action = "hit" | "stand" | "double" | "surrender";

function inRange(n: number, lo: number, hi: number): boolean {
  return n >= lo && n <= hi;
}

/**
 * Basic strategy for a multi-deck, dealer-stands-soft-17 game (matches
 * engine.ts's actual dealer rule and cards.ts's infinite-deck model).
 * Reference: "Multi-Deck, Dealer Stands Soft 17, Double after Split" chart.
 *
 * canDouble/canSurrender reflect whether the ACTION is legal right now (both
 * are only ever true on a fresh 2-card hand - see engine.ts's
 * canDoubleOrSurrender) - when a cell's real answer needs one that isn't
 * available, this falls back exactly the way the reference chart's key says
 * to ("D = double if allowed, else hit", "SR = surrender if allowed, else
 * hit", "D/S = double if allowed, else stand"), rather than pretending hit
 * is always the fallback.
 */
export function optimalAction(
  total: number,
  isSoft: boolean,
  dealerUpcard: number,
  canDouble: boolean,
  canSurrender: boolean,
): Action {
  const up = dealerUpcard === 1 ? 11 : Math.min(dealerUpcard, 10);

  if (isSoft) {
    if (total === 13 || total === 14) {
      // A2, A3
      return inRange(up, 5, 6) && canDouble ? "double" : "hit";
    }
    if (total === 15 || total === 16) {
      // A4, A5
      return inRange(up, 4, 6) && canDouble ? "double" : "hit";
    }
    if (total === 17) {
      // A6
      return inRange(up, 3, 6) && canDouble ? "double" : "hit";
    }
    if (total === 18) {
      // A7
      if (inRange(up, 3, 6)) return canDouble ? "double" : "stand";
      if (up === 2 || up === 7 || up === 8) return "stand";
      return "hit"; // 9, 10, Ace
    }
    return "stand"; // soft 19+ (A8, A9, A10)
  }

  if (total <= 8) return "hit";
  if (total === 9) return inRange(up, 3, 6) && canDouble ? "double" : "hit";
  if (total === 10) return inRange(up, 2, 9) && canDouble ? "double" : "hit";
  if (total === 11) return inRange(up, 2, 10) && canDouble ? "double" : "hit";
  if (total === 12) return inRange(up, 4, 6) ? "stand" : "hit";
  if (total === 13 || total === 14) return inRange(up, 2, 6) ? "stand" : "hit";
  if (total === 15) {
    if (inRange(up, 2, 6)) return "stand";
    if (up === 10) return canSurrender ? "surrender" : "hit";
    return "hit"; // 7, 8, 9, Ace
  }
  if (total === 16) {
    if (inRange(up, 2, 6)) return "stand";
    if (up === 9 || up === 10 || up === 11) return canSurrender ? "surrender" : "hit";
    return "hit"; // 7, 8
  }
  return "stand"; // hard 17+
}

/** Never take insurance - it's -EV for a basic-strategy player regardless of hand/upcard. */
export function shouldTakeInsurance(): false {
  return false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/strategy.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/game/strategy.ts src/game/strategy.test.ts
git commit -m "Add double-down and surrender to basic strategy grading"
```

---

### Task 2: Add `double` and `surrender` engine actions

**Files:**
- Modify: `src/game/engine.ts`
- Test: `src/game/engine.test.ts` (append new `describe` blocks; do not remove existing ones)

**Interfaces:**
- Consumes: `optimalAction(total, isSoft, dealerUpcard, canDouble, canSurrender): Action` from Task 1.
- Produces:
  - `export type Outcome = "win" | "lose" | "push" | "surrender";`
  - `export function canDoubleOrSurrender(state: GameState): boolean`
  - `export function double(state: GameState): GameState`
  - `export function surrender(state: GameState): GameState`
  - Refactored-but-still-present `export function stand(state: GameState): GameState` (same signature, same behavior, now sharing a `finishPlayerTurn` helper with `double`)

- [ ] **Step 1: Write the failing tests**

Append to the end of `src/game/engine.test.ts` (keep every existing `describe` block above untouched):

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL — `engine.canDoubleOrSurrender`, `engine.double`, and `engine.surrender` don't exist yet.

- [ ] **Step 3: Write the implementation**

In `src/game/engine.ts`, change the `Outcome` type:

```typescript
export type Outcome = "win" | "lose" | "push" | "surrender";
```

Replace `recordDecision` with a version that accepts the two new context flags:

```typescript
function recordDecision(state: GameState, action: Action, canDouble: boolean, canSurrender: boolean): DecisionRecord {
  const hv = handValue(state.playerHand);
  const dealerUpcard = state.dealerHand[0].rank;
  const optimal = optimalAction(hv.total, hv.isSoft, dealerUpcard, canDouble, canSurrender);
  return { total: hv.total, isSoft: hv.isSoft, dealerUpcard, action, optimal, wasCorrect: optimal === action };
}
```

Update the two existing call sites of `recordDecision` (inside `hit` and `stand`) to pass the new arguments. Both `hit` and `stand` can be called at any point in the hand, and by the time either is called, double/surrender may or may not still be legal — compute it the same way `canDoubleOrSurrender` does:

```typescript
export function hit(state: GameState): GameState {
  const decision = recordDecision(state, "hit", state.playerHand.length === 2, state.playerHand.length === 2);
  const playerHand = [...state.playerHand, drawCard()];
  let next: GameState = { ...state, playerHand, handDecisions: [...state.handDecisions, decision] };
  if (handValue(playerHand).isBust) {
    next = { ...next, dealerHoleHidden: false };
    return settle(next);
  }
  return next;
}

export function stand(state: GameState): GameState {
  const decision = recordDecision(state, "stand", state.playerHand.length === 2, state.playerHand.length === 2);
  const next: GameState = { ...state, handDecisions: [...state.handDecisions, decision] };
  return finishPlayerTurn(next);
}
```

Add the shared tail helper `finishPlayerTurn` (extracted from `stand`'s old body) directly above `stand`:

```typescript
function finishPlayerTurn(state: GameState): GameState {
  const next: GameState = { ...state, dealerHoleHidden: false, phase: "dealer-turn" };
  return playDealerAndSettle(next);
}
```

Add `canDoubleOrSurrender`, `double`, and `surrender` after `stand`:

```typescript
/** Double-down and surrender are only legal on the initial 2-card hand, before any hit. */
export function canDoubleOrSurrender(state: GameState): boolean {
  return state.phase === "player-turn" && state.playerHand.length === 2;
}

/**
 * Draws exactly one card, then commits to standing - win, lose, or bust,
 * the player's turn ends here. This is a skill-graded decision only: Sharp21
 * has no mechanism to collect a second on-chain payment mid-hand, so there
 * is no real "doubled wager" here, just the standard double-down rule of
 * play (one card, then stand) for grading purposes.
 */
export function double(state: GameState): GameState {
  const decision = recordDecision(state, "double", true, true);
  const playerHand = [...state.playerHand, drawCard()];
  const next: GameState = { ...state, playerHand, handDecisions: [...state.handDecisions, decision] };
  if (handValue(playerHand).isBust) {
    return settle({ ...next, dealerHoleHidden: false });
  }
  return finishPlayerTurn(next);
}

/**
 * Ends the hand immediately without drawing again. Like double(), this is a
 * skill-graded decision only - real casino surrender returns half the
 * wager, but Sharp21 doesn't simulate wager payouts client-side at all
 * (see engine.ts's settle(), which never reads state.wager), so there is no
 * refund logic to write here.
 */
export function surrender(state: GameState): GameState {
  const decision = recordDecision(state, "surrender", true, true);
  const next: GameState = {
    ...state,
    handDecisions: [...state.handDecisions, decision],
    dealerHoleHidden: false,
  };
  return finalizeRound(next, "surrender", "Surrendered — half your entry back.");
}
```

Extract the shared bookkeeping tail of `settle` into a new `finalizeRound` helper, and have `settle` call it. Replace the existing `settle` function with:

```typescript
function finalizeRound(state: GameState, outcome: Outcome, message: string): GameState {
  const correctInHand = state.handDecisions.filter((d) => d.wasCorrect).length;
  return {
    ...state,
    phase: "round-over",
    outcome,
    lastMessage: message,
    handsPlayed: state.handsPlayed + 1,
    correctDecisions: state.correctDecisions + correctInHand,
    totalDecisions: state.totalDecisions + state.handDecisions.length,
  };
}

function settle(state: GameState): GameState {
  const playerHV = handValue(state.playerHand);
  const dealerHV = handValue(state.dealerHand);

  let outcome: Outcome;
  let message: string;
  if (playerHV.isBust) {
    outcome = "lose";
    message = `Bust at ${playerHV.total} — dealer wins the hand.`;
  } else if (dealerHV.isBust) {
    outcome = "win";
    message = `Dealer busts at ${dealerHV.total} — you win the hand.`;
  } else if (playerHV.isBlackjack && !dealerHV.isBlackjack) {
    outcome = "win";
    message = "Blackjack!";
  } else if (dealerHV.isBlackjack && !playerHV.isBlackjack) {
    outcome = "lose";
    message = "Dealer has blackjack.";
  } else if (playerHV.total > dealerHV.total) {
    outcome = "win";
    message = `${playerHV.total} beats ${dealerHV.total}.`;
  } else if (dealerHV.total > playerHV.total) {
    outcome = "lose";
    message = `Dealer's ${dealerHV.total} beats your ${playerHV.total}.`;
  } else {
    outcome = "push";
    message = `Push at ${playerHV.total}.`;
  }

  return finalizeRound(state, outcome, message);
}
```

Note `recordDecision`'s two new parameters are computed as `state.playerHand.length === 2` at every call site above (in `hit`/`stand`) or hardcoded `true` in `double`/`surrender` (both are only ever called when `canDoubleOrSurrender(state)` is already true, enforced by the UI in Task 3 not rendering their buttons otherwise).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine.test.ts`
Expected: PASS (all tests green, including every pre-existing test in the file)

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "Add double-down and surrender engine actions"
```

---

### Task 3: Add insurance as a new phase

**Files:**
- Modify: `src/game/engine.ts`
- Test: `src/game/engine.test.ts` (append)

**Interfaces:**
- Produces:
  - `Phase` gains `"insurance"`: `export type Phase = "betting" | "insurance" | "player-turn" | "dealer-turn" | "round-over";`
  - `GameState` gains `insuranceDecision: "taken" | "declined" | null;`
  - `export function takeInsurance(state: GameState): GameState`
  - `export function declineInsurance(state: GameState): GameState`
  - `placeBet` now routes through `"insurance"` phase whenever the dealer's up-card is an Ace, instead of checking for blackjack immediately.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/engine.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL — `"insurance"` is not a valid `Phase`, `insuranceDecision` doesn't exist on `GameState`, and `takeInsurance`/`declineInsurance` don't exist.

- [ ] **Step 3: Write the implementation**

In `src/game/engine.ts`, update the `Phase` type and `GameState` interface:

```typescript
export type Phase = "betting" | "insurance" | "player-turn" | "dealer-turn" | "round-over";
```

```typescript
export interface GameState {
  phase: Phase;
  wager: number;
  playerHand: PlayingCard[];
  dealerHand: PlayingCard[];
  dealerHoleHidden: boolean;
  outcome: Outcome | null;
  lastMessage: string | null;
  handsPlayed: number;
  correctDecisions: number;
  totalDecisions: number;
  handDecisions: DecisionRecord[];
  insuranceDecision: "taken" | "declined" | null;
}
```

Update `initialState` to include the new field:

```typescript
export function initialState(): GameState {
  return {
    phase: "betting",
    wager: 0,
    playerHand: [],
    dealerHand: [],
    dealerHoleHidden: true,
    outcome: null,
    lastMessage: null,
    handsPlayed: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    handDecisions: [],
    insuranceDecision: null,
  };
}
```

Replace `placeBet` to route through the insurance phase when the dealer shows an Ace:

```typescript
export function placeBet(state: GameState, wager: number): GameState {
  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];
  const next: GameState = {
    ...state,
    phase: "player-turn",
    wager,
    playerHand,
    dealerHand,
    dealerHoleHidden: true,
    outcome: null,
    lastMessage: null,
    handDecisions: [],
    insuranceDecision: null,
  };

  const dealerShowsAce = dealerHand[0].rank === 1;
  if (dealerShowsAce) {
    return { ...next, phase: "insurance" };
  }

  if (handValue(playerHand).isBlackjack || handValue(dealerHand).isBlackjack) {
    return settle({ ...next, dealerHoleHidden: false });
  }
  return next;
}
```

Add `takeInsurance`/`declineInsurance` and their shared helper after `placeBet`:

```typescript
/**
 * Insurance is always -EV for a basic-strategy player (see
 * strategy.ts's shouldTakeInsurance) regardless of the player's own hand,
 * so it's graded as a plain correct/incorrect call rather than through
 * recordDecision (which is shaped around a player-hand total that doesn't
 * apply to a side bet). It still counts toward the running
 * correctDecisions/totalDecisions the same way any other decision does.
 */
function resolveInsurance(state: GameState, decision: "taken" | "declined"): GameState {
  const correct = decision === "declined";
  const next: GameState = {
    ...state,
    insuranceDecision: decision,
    correctDecisions: state.correctDecisions + (correct ? 1 : 0),
    totalDecisions: state.totalDecisions + 1,
  };
  if (handValue(next.playerHand).isBlackjack || handValue(next.dealerHand).isBlackjack) {
    return settle({ ...next, dealerHoleHidden: false });
  }
  return { ...next, phase: "player-turn" };
}

export function declineInsurance(state: GameState): GameState {
  return resolveInsurance(state, "declined");
}

export function takeInsurance(state: GameState): GameState {
  return resolveInsurance(state, "taken");
}
```

Update `nextHand` to reset `insuranceDecision` (it already spreads from a fresh `initialState()`, so no change is actually needed there — verify this by reading the current `nextHand` implementation before assuming; if it does anything other than `{ ...initialState(), handsPlayed, correctDecisions, totalDecisions }`, adjust accordingly).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/engine.test.ts`
Expected: PASS (all tests green, including every pre-existing test)

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "Add insurance as a graded pre-turn decision"
```

---

### Task 4: Report insurance's contribution to the backend correctly

**Files:**
- Modify: `src/hooks/useBlackjack.ts`

**Interfaces:**
- Consumes: `state.insuranceDecision` from Task 3, `state.handDecisions` (unchanged shape from Task 1/2).

**Context:** `useBlackjack.ts` has an effect that reports each finished hand's decision grade to the backend leaderboard via `recordHand({ correctDecisions, totalDecisions, ... })`. It currently derives `correctThisHand`/`totalDecisions` entirely from `state.handDecisions`. Insurance decisions do NOT get pushed into `handDecisions` (Task 3 tracks them separately via `state.insuranceDecision` and bumps the *cumulative* `state.correctDecisions`/`state.totalDecisions` directly) — so without this task, an insurance call would correctly affect the on-screen running Skill Score but silently be dropped from what's reported to the backend for that hand.

- [ ] **Step 1: Read the current reporting effect**

Read `src/hooks/useBlackjack.ts` and find the `useEffect` block that calls `recordHand`. It currently computes:

```typescript
const correctThisHand = state.handDecisions.filter((d) => d.wasCorrect).length;
void recordHand({
  deviceId: identityRef.current,
  correctDecisions: correctThisHand,
  totalDecisions: state.handDecisions.length,
  wagerLuna: meta.wagerLuna,
  entryFeeTxHash: meta.entryFeeTxHash,
  payoutAddress: account,
});
```

- [ ] **Step 2: Write the failing test**

Check whether `src/hooks/useBlackjack.ts` has an existing test file (`src/hooks/useBlackjack.test.ts` or similar) by running `ls src/hooks/*.test.ts`. If one exists, add a test there following its existing conventions for mocking `recordHand`/`engine`, asserting that after a hand where `insuranceDecision === "declined"`, `recordHand` is called with `totalDecisions` one higher than `state.handDecisions.length` and `correctDecisions` one higher than `state.handDecisions.filter(d => d.wasCorrect).length`. If no test file exists for this hook yet, skip this step and Step 4 below (React-hook testing needs `@testing-library/react-hooks` or similar, which isn't installed — don't add a new testing dependency just for this one assertion) and rely on Step 5's manual browser verification instead.

- [ ] **Step 3: Update the reporting effect**

In `src/hooks/useBlackjack.ts`, change the computation inside the reporting effect to:

```typescript
const insuranceGraded = state.insuranceDecision !== null;
const correctThisHand = state.handDecisions.filter((d) => d.wasCorrect).length + (state.insuranceDecision === "declined" ? 1 : 0);
const totalDecisionsThisHand = state.handDecisions.length + (insuranceGraded ? 1 : 0);
void recordHand({
  deviceId: identityRef.current,
  correctDecisions: correctThisHand,
  totalDecisions: totalDecisionsThisHand,
  wagerLuna: meta.wagerLuna,
  entryFeeTxHash: meta.entryFeeTxHash,
  payoutAddress: account,
});
```

- [ ] **Step 4: Run the test from Step 2 if one was added**

Run: `npx vitest run src/hooks/useBlackjack.test.ts` (only if that file exists)
Expected: PASS

- [ ] **Step 5: Manually verify in the browser**

Start the dev server (`npm run dev`), open the mini-app view, play hands until the dealer shows an Ace, decline insurance, finish the hand, and confirm the on-screen "Skill Score" panel's `total` count increases by one more than the number of hit/stand/double/surrender choices you made that hand (i.e. insurance is being counted).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBlackjack.ts
git commit -m "Report insurance decisions to the backend leaderboard"
```

---

### Task 5: Wire double/surrender/insurance into the Hud

**Files:**
- Modify: `src/components/Hud.tsx`
- Modify: `src/components/GameWidget.tsx`
- Modify: `src/hooks/useBlackjack.ts`

**Interfaces:**
- Consumes: `engine.double`, `engine.surrender`, `engine.takeInsurance`, `engine.declineInsurance`, `engine.canDoubleOrSurrender` from Tasks 2–3.
- Produces: `useBlackjack()`'s returned object gains `onDouble: () => void`, `onSurrender: () => void`, `onTakeInsurance: () => void`, `onDeclineInsurance: () => void`, `canDoubleOrSurrender: boolean` (derived from `engine.canDoubleOrSurrender(state)`).

- [ ] **Step 1: Add the new callbacks to `useBlackjack.ts`**

Find the existing `hit`/`stand`/`deal` callbacks in `src/hooks/useBlackjack.ts` (each is a `useCallback(() => setState((s) => engine.hit(s)), [])`-shaped one-liner). Add four more, following the exact same pattern, right after `stand`:

```typescript
const double = useCallback(() => {
  setState((s) => engine.double(s));
}, []);
const surrender = useCallback(() => {
  setState((s) => engine.surrender(s));
}, []);
const takeInsurance = useCallback(() => {
  setState((s) => engine.takeInsurance(s));
}, []);
const declineInsurance = useCallback(() => {
  setState((s) => engine.declineInsurance(s));
}, []);
```

Add the corresponding import names (`double`, `surrender`, `takeInsurance`, `declineInsurance`, `canDoubleOrSurrender`) to the existing `import * as engine from "../game/engine";` line — no change needed there, it's a namespace import; just make sure the new functions actually exist on `engine` (they will, from Tasks 2–3).

In the hook's return object, add:

```typescript
onDouble: double,
onSurrender: surrender,
onTakeInsurance: takeInsurance,
onDeclineInsurance: declineInsurance,
canDoubleOrSurrender: engine.canDoubleOrSurrender(state),
```

- [ ] **Step 2: Add an insurance-phase branch to `Hud.tsx`**

In `src/components/Hud.tsx`, add new props to the component's destructured argument and type:

```typescript
onDouble: () => void;
onSurrender: () => void;
onTakeInsurance: () => void;
onDeclineInsurance: () => void;
canDoubleOrSurrender: boolean;
```

Add a new branch immediately before the existing `if (state.phase === "betting")` check:

```typescript
if (state.phase === "insurance") {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="sk-eyebrow text-[0.6rem] opacity-80 text-center max-w-[16rem]">
        Dealer shows an Ace. Insurance pays if they have blackjack — but it's a losing bet for a
        skill-based player either way.
      </div>
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="sk-btn sk-btn--primary sk-btn--tap text-sm" onClick={onDeclineInsurance}>
          No insurance
        </button>
        <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onTakeInsurance}>
          Take insurance
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add double/surrender buttons to the `player-turn` branch**

In `Hud.tsx`'s existing `if (state.phase === "player-turn")` branch, add Double and Surrender buttons alongside the existing Hit/Stand ones, shown only when `canDoubleOrSurrender` is true:

```typescript
if (state.phase === "player-turn") {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="flex items-center justify-center gap-3">
        <button
          className="sk-btn sk-btn--primary sk-btn--tap relative"
          onClick={() => {
            setHitPulse((p) => p + 1);
            onHit();
          }}
        >
          Hit
          {hitPulse > 0 && <span key={hitPulse} className="sk-btn-ripple" aria-hidden="true" />}
        </button>
        <button
          className="sk-btn sk-btn--amber sk-btn--tap relative"
          onClick={() => {
            setStandPulse((p) => p + 1);
            onStand();
          }}
        >
          Stand
          {standPulse > 0 && <span key={standPulse} className="sk-btn-ripple" aria-hidden="true" />}
        </button>
      </div>
      {canDoubleOrSurrender && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onDouble}>
            Double
          </button>
          <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onSurrender}>
            Surrender
          </button>
        </div>
      )}
    </div>
  );
}
```

Keep the existing `hitPulse`/`standPulse` state declarations above this block exactly as they are — this task only adds to the render output, not the pulse-animation mechanism.

- [ ] **Step 4: Thread the new props through `GameWidget.tsx`**

Find where `GameWidget.tsx` renders `<Hud .../>` (it passes `state`, `payment`, `onBet`, `onHit`, `onStand`, `onDeal`, `onDismissPaymentError`, `usingScanToPay`, `onScannedPaid` today). Add:

```typescript
onDouble={pve.onDouble}
onSurrender={pve.onSurrender}
onTakeInsurance={pve.onTakeInsurance}
onDeclineInsurance={pve.onDeclineInsurance}
canDoubleOrSurrender={pve.canDoubleOrSurrender}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `BotVsBot.tsx` also renders `<Hud />` directly (check with `grep -rn "<Hud" src/`), it will now fail to type-check because it's missing the five new required props — if so, add a bot-appropriate no-op/never-shown set (bots never reach the insurance phase or double/surrender since their own auto-play loop, not this Hud, drives their decisions — check how `BotVsBot.tsx` currently renders bot hands before assuming it uses this same `Hud` component at all).

- [ ] **Step 6: Manually verify in the browser**

Start the dev server, play PvE hands until you see: (a) the insurance prompt when the dealer shows an Ace, with both buttons working and the phase correctly advancing afterward; (b) Double and Surrender buttons present on a fresh 2-card hand and absent after hitting once; (c) Double drawing one card then automatically finishing the turn; (d) Surrender ending the hand immediately with a "Surrendered" message. Check the browser console for errors at each step.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useBlackjack.ts src/components/Hud.tsx src/components/GameWidget.tsx
git commit -m "Wire double/surrender/insurance into the Hud"
```

---

### Task 6: Show the surrender outcome correctly in the Table result panel

**Files:**
- Modify: `src/components/Table.tsx`

**Interfaces:**
- Consumes: `state.outcome` (now possibly `"surrender"`, from Task 3).

**Context:** `Table.tsx` renders the round-over result panel with a title derived from `state.outcome` (`"You win"` / `"Dealer wins"` / `"Push"`) and a color (`sk-result-panel--win/lose/push`, from `sketch.css`/`gameplay.css`, applied in the earlier gameplay-polish work). `"surrender"` needs its own title and should reuse the existing amber/push styling rather than requiring a new CSS class — check `gameplay.css` for `.sk-result-panel--push`'s exact color before deciding this, but do not add a new `--surrender` variant unless amber genuinely doesn't fit (a surrender is a deliberate, correct-or-incorrect choice, not a coin-flip outcome — visually distinguishing it from a push is nice-to-have, not required by this task).

- [ ] **Step 1: Update the outcome title logic**

Find this line in `Table.tsx` (inside the round-over result panel JSX):

```typescript
{state.outcome === "win" ? "You win" : state.outcome === "lose" ? "Dealer wins" : "Push"}
```

Replace it with:

```typescript
{state.outcome === "win"
  ? "You win"
  : state.outcome === "lose"
    ? "Dealer wins"
    : state.outcome === "surrender"
      ? "Surrendered"
      : "Push"}
```

- [ ] **Step 2: Update the result-panel color class**

Find the className expression that includes `` `sk-result-panel--${state.outcome ?? "push"}` `` and change the fallback/mapping so `"surrender"` resolves to the amber push styling rather than looking for a nonexistent `sk-result-panel--surrender` class:

```typescript
`sk-result-panel sk-result-panel--${state.outcome === "surrender" ? "push" : (state.outcome ?? "push")}`
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Play a hand, surrender it, and confirm the result panel reads "Surrendered" with the amber-tinted styling (not a blank/broken class), and that `state.lastMessage` ("Surrendered — half your entry back.") still renders underneath it exactly like the win/lose/push message does today.

- [ ] **Step 5: Commit**

```bash
git add src/components/Table.tsx
git commit -m "Show surrender as its own round-over outcome"
```

---

### Task 7: Update the on-page strategy reference copy

**Files:**
- Modify: `src/components/WebLanding.tsx`

**Interfaces:** None — copy-only change.

**Context:** `WebLanding.tsx`'s sidebar has a "Quick strategy reference" card with hard-coded copy: `"Hard 12–16 vs. dealer 2–6: stand. Vs. dealer 7–Ace: hit. Anything 11 or under: always hit. Live feedback after every decision shows you the right call either way."` This is now inaccurate/incomplete — it doesn't mention double, surrender, or insurance at all, and would actively mislead a new player about what's available.

- [ ] **Step 1: Update the copy**

Find the `<p>` inside the "Quick strategy reference" card in `WebLanding.tsx` and replace its text with:

```
Hard 12–16 vs. dealer 2–6: stand. Vs. dealer 7–Ace: hit (or surrender 15–16 vs. a strong upcard, if you'd rather not risk it). Double down on strong two-card totals like 10 or 11. Never take insurance. Live feedback after every decision shows you the right call either way.
```

- [ ] **Step 2: Manually verify in the browser**

Load the wide web-landing view and confirm the sidebar card renders the updated copy without overflowing its container.

- [ ] **Step 3: Commit**

```bash
git add src/components/WebLanding.tsx
git commit -m "Update strategy reference copy for double/surrender/insurance"
```

---

## Self-Review Notes

- **Spec coverage:** Insurance ✓ (Task 3), Double down ✓ (Tasks 1–2), Surrender ✓ (Tasks 1–2), backend reporting consistency ✓ (Task 4), UI wiring ✓ (Task 5), outcome display ✓ (Task 6), player-facing copy ✓ (Task 7).
- **No real-money math added anywhere** — every new function is explicitly commented as skill-graded-only, consistent with the Global Constraints section.
- **Type consistency verified:** `Action` (strategy.ts) → `DecisionRecord.action`/`.optimal` (engine.ts) → nowhere else needs it directly; `Phase`/`Outcome`/`insuranceDecision` are each defined once (engine.ts) and consumed by name-matching string literals in Hud.tsx/Table.tsx, not re-declared.
- **Known follow-up, intentionally out of scope here:** splitting pairs is a separate, larger plan (`docs/superpowers/plans/2026-07-30-blackjack-split-pairs.md`) since it requires multi-hand state that would make this plan's tasks much harder to land independently.
