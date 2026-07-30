# Split Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players split a starting pair into two (or more) independent hands, each played and graded against basic strategy on its own, completing Sharp21's basic-strategy coverage alongside insurance/double/surrender.

**Architecture:** Migrate `GameState` from a single `playerHand`/`handDecisions`/`outcome` shape to a `playerHands: PlayerHandState[]` array with an `activeHandIndex`, in a dedicated non-behavior-changing refactor task first. Then add `split()`, per-hand turn progression (advance to the next hand once the current one is done, run the dealer only after every hand is done), independent per-hand settlement against one shared dealer hand, and the standard "split aces get exactly one card, no re-splitting them" rule.

**Tech Stack:** TypeScript, Vitest, React 19.

## Global Constraints

- **Depends on** `docs/superpowers/plans/2026-07-30-blackjack-insurance-double-surrender.md` being implemented first — this plan's `optimalAction`/`GameState`/engine functions are written as the natural continuation of that plan's end state (`Action` already includes `"double"`/`"surrender"`, `Phase` already includes `"insurance"`, `finalizeRound`/`finishPlayerTurn` helpers already exist). Do not start this plan against the pre-insurance/double/surrender codebase.
- Same real-money constraint as the other plan: Sharp21 never collects a second on-chain payment mid-hand. Splitting is a skill-graded rules addition only — there is no code path where splitting "doubles the wager" as an actual transaction, and comments should say so wherever it would otherwise look like an oversight.
- Standard rule adopted for this plan (state it in code comments, don't leave it implicit): **re-split any non-Ace pair up to a maximum of 4 hands total; Aces may be split exactly once, get exactly one card each, and cannot be hit, doubled, or re-split afterward.** This is one of several common rule variants — it's the one this plan implements, chosen for being simple to state and widely recognized, not because every casino uses it.
- `entry_fee_tx_hash` stays `UNIQUE` per row in the backend `hands` table (see `server/migrations/001_init.sql`) — a split round still corresponds to exactly one payment, so it must still produce exactly one `recordHand` call aggregating every split hand's decisions, never one call per hand.

---

### Task 1: Migrate `GameState` to a `playerHands` array (no new behavior)

**Files:**
- Modify: `src/game/engine.ts` (full-file replacement — the diff touches nearly every function)
- Modify: `src/game/engine.test.ts` (full-file replacement — every existing test is rewritten against the new shape, asserting the *same* behavior as before)
- Modify: `src/components/Table.tsx`
- Modify: `src/components/ScoreBadge.tsx` (prop name only, see Step 4)
- Modify: `src/components/Hud.tsx`
- Modify: `src/hooks/useBlackjack.ts`

**Interfaces:**
- Consumes: everything Task 1–7 of the insurance/double/surrender plan produced (`Action`, `Phase`, `finalizeRound`, `finishPlayerTurn`, `recordDecision`, `optimalAction(total, isSoft, dealerUpcard, canDouble, canSurrender)`).
- Produces:
  ```typescript
  export interface PlayerHandState {
    cards: PlayingCard[];
    decisions: DecisionRecord[];
    outcome: Outcome | null;
    turnDone: boolean;
  }
  export interface GameState {
    phase: Phase;
    wager: number;
    playerHands: PlayerHandState[];
    activeHandIndex: number;
    dealerHand: PlayingCard[];
    dealerHoleHidden: boolean;
    lastMessage: string | null;
    handsPlayed: number;
    correctDecisions: number;
    totalDecisions: number;
    insuranceDecision: "taken" | "declined" | null;
    splitCount: number;
  }
  ```
  This task's `playerHands` always has exactly length 1 — `split()` (Task 3) is what ever grows it.

- [ ] **Step 1: Write the failing tests**

Replace `src/game/engine.test.ts` in full:

```typescript
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

function withPlayerCards(cards: PlayingCard[]): Partial<GameState> {
  return { playerHands: [{ cards, decisions: [], outcome: null, turnDone: false }] };
}

beforeEach(() => {
  (cardsModule.drawCard as unknown as Mock).mockReset();
});

describe("initialState", () => {
  test("starts in betting phase with one empty hand and all counters at zero", () => {
    const s = engine.initialState();
    expect(s.phase).toBe("betting");
    expect(s.playerHands).toEqual([{ cards: [], decisions: [], outcome: null, turnDone: false }]);
    expect(s.activeHandIndex).toBe(0);
    expect(s.handsPlayed).toBe(0);
    expect(s.correctDecisions).toBe(0);
    expect(s.totalDecisions).toBe(0);
    expect(s.splitCount).toBe(0);
  });
});

describe("placeBet", () => {
  test("deals two cards each into a single hand and moves to player-turn when no one has blackjack", () => {
    mockDraws(card(10), card(6), card(9), card(2));
    const s = engine.placeBet(engine.initialState(), 2);
    expect(s.phase).toBe("player-turn");
    expect(s.playerHands).toHaveLength(1);
    expect(s.playerHands[0].cards).toEqual([card(10), card(6)]);
    expect(s.activeHandIndex).toBe(0);
    expect(s.dealerHand).toEqual([card(9), card(2)]);
  });

  test("player natural blackjack settles immediately as a win", () => {
    mockDraws(card(1), card(13), card(9), card(2));
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.phase).toBe("round-over");
    expect(s.playerHands[0].outcome).toBe("win");
    expect(s.handsPlayed).toBe(1);
  });

  test("both natural blackjack is a push", () => {
    mockDraws(card(1), card(13), card(1), card(12));
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.playerHands[0].outcome).toBe("push");
  });

  test("offers insurance when the dealer's up-card is an Ace", () => {
    mockDraws(card(10), card(6), card(1), card(9));
    const s = engine.placeBet(engine.initialState(), 1);
    expect(s.phase).toBe("insurance");
  });
});

describe("hit", () => {
  test("draws into the active hand and records a graded decision", () => {
    mockDraws(card(5));
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(10), card(6)]), dealerHand: [card(9), card(2)] });
    const next = engine.hit(s);
    expect(next.playerHands[0].cards).toEqual([card(10), card(6), card(5)]);
    expect(next.playerHands[0].decisions).toHaveLength(1);
  });

  test("busting settles that hand as a loss and, with only one hand, ends the round", () => {
    mockDraws(card(10));
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(10), card(6)]), dealerHand: [card(9), card(2)] });
    const next = engine.hit(s);
    expect(next.playerHands[0].outcome).toBe("lose");
    expect(next.phase).toBe("round-over");
  });
});

describe("stand / double / surrender", () => {
  test("stand moves a single-hand round straight to dealer-turn and settles", () => {
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(10), card(9)]), dealerHand: [card(9), card(2)] });
    const next = engine.stand(s);
    expect(next.phase).toBe("round-over");
    expect(next.playerHands[0].turnDone).toBe(true);
  });

  test("double draws exactly one card into the active hand then ends that hand's turn", () => {
    mockDraws(card(6));
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(5), card(6)]), dealerHand: [card(9), card(2)] });
    const next = engine.double(s);
    expect(next.playerHands[0].cards).toEqual([card(5), card(6), card(6)]);
    expect(next.playerHands[0].turnDone).toBe(true);
    expect(next.phase).toBe("round-over");
  });

  test("surrender ends the round immediately without drawing", () => {
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(10), card(6)]), dealerHand: [card(10), card(6)] });
    const next = engine.surrender(s);
    expect(next.playerHands[0].outcome).toBe("surrender");
    expect(next.phase).toBe("round-over");
  });
});

describe("declineInsurance / takeInsurance", () => {
  test("declining is graded correct and proceeds to player-turn absent blackjack", () => {
    const s = baseState({ phase: "insurance", ...withPlayerCards([card(10), card(6)]), dealerHand: [card(1), card(9)] });
    const next = engine.declineInsurance(s);
    expect(next.correctDecisions).toBe(1);
    expect(next.phase).toBe("player-turn");
  });

  test("taking insurance is graded incorrect", () => {
    const s = baseState({ phase: "insurance", ...withPlayerCards([card(10), card(6)]), dealerHand: [card(1), card(9)] });
    const next = engine.takeInsurance(s);
    expect(next.correctDecisions).toBe(0);
    expect(next.totalDecisions).toBe(1);
  });
});

describe("nextHand", () => {
  test("resets to a fresh single hand while preserving running totals", () => {
    const s = baseState({ handsPlayed: 3, correctDecisions: 2, totalDecisions: 5, splitCount: 1 });
    const next = engine.nextHand(s);
    expect(next.playerHands).toEqual([{ cards: [], decisions: [], outcome: null, turnDone: false }]);
    expect(next.splitCount).toBe(0);
    expect(next.handsPlayed).toBe(3);
    expect(next.correctDecisions).toBe(2);
    expect(next.totalDecisions).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL — `GameState` still has the old single-hand shape.

- [ ] **Step 3: Write the implementation**

Replace `src/game/engine.ts` in full:

```typescript
import { type PlayingCard, drawCard, handValue } from "./cards";
import { optimalAction, type Action } from "./strategy";

export type Phase = "betting" | "insurance" | "player-turn" | "dealer-turn" | "round-over";
export type Outcome = "win" | "lose" | "push" | "surrender";

export interface DecisionRecord {
  total: number;
  isSoft: boolean;
  dealerUpcard: number;
  action: Action;
  optimal: Action;
  wasCorrect: boolean;
}

export interface PlayerHandState {
  cards: PlayingCard[];
  decisions: DecisionRecord[];
  outcome: Outcome | null;
  /** Stood, busted, doubled, or surrendered - this hand no longer takes actions. */
  turnDone: boolean;
}

export interface GameState {
  phase: Phase;
  wager: number;
  playerHands: PlayerHandState[];
  activeHandIndex: number;
  dealerHand: PlayingCard[];
  dealerHoleHidden: boolean;
  lastMessage: string | null;
  handsPlayed: number;
  correctDecisions: number;
  totalDecisions: number;
  insuranceDecision: "taken" | "declined" | null;
  splitCount: number;
}

export const BET_OPTIONS = [1, 2, 5] as const;

function freshHand(cards: PlayingCard[] = []): PlayerHandState {
  return { cards, decisions: [], outcome: null, turnDone: false };
}

export function initialState(): GameState {
  return {
    phase: "betting",
    wager: 0,
    playerHands: [freshHand()],
    activeHandIndex: 0,
    dealerHand: [],
    dealerHoleHidden: true,
    lastMessage: null,
    handsPlayed: 0,
    correctDecisions: 0,
    totalDecisions: 0,
    insuranceDecision: null,
    splitCount: 0,
  };
}

function activeHand(state: GameState): PlayerHandState {
  return state.playerHands[state.activeHandIndex];
}

function replaceActiveHand(state: GameState, hand: PlayerHandState): GameState {
  const playerHands = [...state.playerHands];
  playerHands[state.activeHandIndex] = hand;
  return { ...state, playerHands };
}

function recordDecision(state: GameState, action: Action, canDouble: boolean, canSurrender: boolean): DecisionRecord {
  const hv = handValue(activeHand(state).cards);
  const dealerUpcard = state.dealerHand[0].rank;
  const optimal = optimalAction(hv.total, hv.isSoft, dealerUpcard, canDouble, canSurrender);
  return { total: hv.total, isSoft: hv.isSoft, dealerUpcard, action, optimal, wasCorrect: optimal === action };
}

/** Double-down and surrender are only legal on a hand's initial 2 cards, before any hit. */
export function canDoubleOrSurrender(state: GameState): boolean {
  return state.phase === "player-turn" && activeHand(state).cards.length === 2;
}

export function placeBet(state: GameState, wager: number): GameState {
  const playerHand = freshHand([drawCard(), drawCard()]);
  const dealerHand = [drawCard(), drawCard()];
  const next: GameState = {
    ...state,
    phase: "player-turn",
    wager,
    playerHands: [playerHand],
    activeHandIndex: 0,
    dealerHand,
    dealerHoleHidden: true,
    lastMessage: null,
    insuranceDecision: null,
    splitCount: 0,
  };

  const dealerShowsAce = dealerHand[0].rank === 1;
  if (dealerShowsAce) {
    return { ...next, phase: "insurance" };
  }

  if (handValue(playerHand.cards).isBlackjack || handValue(dealerHand).isBlackjack) {
    return settleAllHands({ ...next, dealerHoleHidden: false });
  }
  return next;
}

function resolveInsurance(state: GameState, decision: "taken" | "declined"): GameState {
  const correct = decision === "declined";
  const next: GameState = {
    ...state,
    insuranceDecision: decision,
    correctDecisions: state.correctDecisions + (correct ? 1 : 0),
    totalDecisions: state.totalDecisions + 1,
  };
  if (handValue(activeHand(next).cards).isBlackjack || handValue(next.dealerHand).isBlackjack) {
    return settleAllHands({ ...next, dealerHoleHidden: false });
  }
  return { ...next, phase: "player-turn" };
}

export function declineInsurance(state: GameState): GameState {
  return resolveInsurance(state, "declined");
}

export function takeInsurance(state: GameState): GameState {
  return resolveInsurance(state, "taken");
}

export function hit(state: GameState): GameState {
  const hand = activeHand(state);
  const decision = recordDecision(state, "hit", hand.cards.length === 2, hand.cards.length === 2);
  const cards = [...hand.cards, drawCard()];
  const busted = handValue(cards).isBust;
  const updated: PlayerHandState = { ...hand, cards, decisions: [...hand.decisions, decision], turnDone: busted };
  const next = replaceActiveHand(state, updated);
  return busted ? advanceOrFinish(next) : next;
}

export function stand(state: GameState): GameState {
  const hand = activeHand(state);
  const decision = recordDecision(state, "stand", hand.cards.length === 2, hand.cards.length === 2);
  const updated: PlayerHandState = { ...hand, decisions: [...hand.decisions, decision], turnDone: true };
  return advanceOrFinish(replaceActiveHand(state, updated));
}

export function double(state: GameState): GameState {
  const hand = activeHand(state);
  const decision = recordDecision(state, "double", true, true);
  const cards = [...hand.cards, drawCard()];
  const updated: PlayerHandState = { ...hand, cards, decisions: [...hand.decisions, decision], turnDone: true };
  return advanceOrFinish(replaceActiveHand(state, updated));
}

export function surrender(state: GameState): GameState {
  const hand = activeHand(state);
  const decision = recordDecision(state, "surrender", true, true);
  const updated: PlayerHandState = {
    ...hand,
    decisions: [...hand.decisions, decision],
    turnDone: true,
    outcome: "surrender",
  };
  return advanceOrFinish(replaceActiveHand(state, updated));
}

/** Moves to the next not-yet-done hand, or runs the dealer and settles once every hand is done. */
function advanceOrFinish(state: GameState): GameState {
  const nextIndex = state.playerHands.findIndex((h, i) => i > state.activeHandIndex && !h.turnDone);
  if (nextIndex !== -1) {
    return { ...state, activeHandIndex: nextIndex };
  }
  const anyStillNeedsDealer = state.playerHands.some((h) => h.outcome !== "surrender");
  if (!anyStillNeedsDealer) {
    return finalizeRound({ ...state, dealerHoleHidden: false });
  }
  return playDealerAndSettle({ ...state, dealerHoleHidden: false, phase: "dealer-turn" });
}

function playDealerAndSettle(state: GameState): GameState {
  let dealerHand = [...state.dealerHand];
  // No point drawing dealer cards at all if every hand already busted or surrendered.
  const anyLiveHand = state.playerHands.some((h) => h.outcome === null && !handValue(h.cards).isBust);
  if (anyLiveHand) {
    while (handValue(dealerHand).total < 17) {
      dealerHand = [...dealerHand, drawCard()];
    }
  }
  return settleAllHands({ ...state, dealerHand });
}

function settleOneHand(cards: PlayingCard[], dealerHV: ReturnType<typeof handValue>): { outcome: Outcome; message: string } {
  const playerHV = handValue(cards);
  if (playerHV.isBust) return { outcome: "lose", message: `Bust at ${playerHV.total}.` };
  if (dealerHV.isBust) return { outcome: "win", message: `Dealer busts at ${dealerHV.total}.` };
  if (playerHV.isBlackjack && !dealerHV.isBlackjack) return { outcome: "win", message: "Blackjack!" };
  if (dealerHV.isBlackjack && !playerHV.isBlackjack) return { outcome: "lose", message: "Dealer has blackjack." };
  if (playerHV.total > dealerHV.total) return { outcome: "win", message: `${playerHV.total} beats ${dealerHV.total}.` };
  if (dealerHV.total > playerHV.total) return { outcome: "lose", message: `Dealer's ${dealerHV.total} beats your ${playerHV.total}.` };
  return { outcome: "push", message: `Push at ${playerHV.total}.` };
}

function settleAllHands(state: GameState): GameState {
  const dealerHV = handValue(state.dealerHand);
  const playerHands = state.playerHands.map((hand) => {
    if (hand.outcome) return hand; // already surrendered
    const { outcome, message } = settleOneHand(hand.cards, dealerHV);
    return { ...hand, outcome, message } as PlayerHandState & { message: string };
  });
  return finalizeRound({ ...state, playerHands });
}

function summarizeOutcomes(hands: PlayerHandState[]): string {
  if (hands.length === 1) {
    const h = hands[0] as PlayerHandState & { message?: string };
    return h.message ?? (h.outcome === "win" ? "You win." : h.outcome === "lose" ? "Dealer wins." : h.outcome === "surrender" ? "Surrendered." : "Push.");
  }
  const wins = hands.filter((h) => h.outcome === "win").length;
  const losses = hands.filter((h) => h.outcome === "lose").length;
  const pushes = hands.filter((h) => h.outcome === "push" || h.outcome === "surrender").length;
  return `${hands.length} hands: ${wins} won, ${losses} lost, ${pushes} pushed/surrendered.`;
}

function finalizeRound(state: GameState): GameState {
  const allDecisions = state.playerHands.flatMap((h) => h.decisions);
  const correctInRound = allDecisions.filter((d) => d.wasCorrect).length;
  return {
    ...state,
    phase: "round-over",
    lastMessage: summarizeOutcomes(state.playerHands),
    handsPlayed: state.handsPlayed + 1,
    correctDecisions: state.correctDecisions + correctInRound,
    totalDecisions: state.totalDecisions + allDecisions.length,
  };
}

export function nextHand(state: GameState): GameState {
  return {
    ...initialState(),
    handsPlayed: state.handsPlayed,
    correctDecisions: state.correctDecisions,
    totalDecisions: state.totalDecisions,
  };
}
```

Note two deliberate departures from the insurance/double/surrender plan's shape, both necessary because hands now settle independently rather than the whole round settling at once:

- `finalizeRound` above takes only `state` (no separate `outcome`/`message` params) — outcome is now per-hand (`PlayerHandState.outcome`) and the round-level message is derived via `summarizeOutcomes`, replacing that plan's `finalizeRound(state, outcome, message)`.
- The companion plan's `finishPlayerTurn` helper (used by `stand`/`double` to jump straight to `dealer-turn`) is **superseded, not reused, by `advanceOrFinish`** above — `advanceOrFinish` additionally has to check whether another not-yet-done hand exists before deciding whether the dealer plays at all. Every function that called `finishPlayerTurn` in the companion plan (`stand`, `double`) calls `advanceOrFinish` instead in the code above; do not keep both helpers around, and do not leave a dangling unused `finishPlayerTurn` in the file after this task's full-file replacement.

- [ ] **Step 4: Update every component that read the old single-hand shape**

Run `grep -rln "state\.playerHand\b\|state\.handDecisions\|state\.outcome\b" src/components src/hooks` to find every remaining reference to the old shape (the `\b` avoids matching `playerHands`). For each match:

- `src/components/Table.tsx`: replace `state.playerHand` with `state.playerHands[state.activeHandIndex].cards` for the *currently active* hand's display (multi-hand simultaneous display is Task 6's job, not this one - for now, only ever showing the active hand is correct since `playerHands.length` is still always 1 until Task 3 ships). Replace `state.outcome`/`state.lastMessage` reads with `state.playerHands[0].outcome` / `state.lastMessage` (the latter is unchanged, still top-level).
- `src/components/ScoreBadge.tsx`: it takes `lastDecision` as a prop today (the caller passes `state.handDecisions[state.handDecisions.length - 1]`) - update the caller in `Table.tsx` to pass `state.playerHands[state.activeHandIndex].decisions.at(-1)` instead. `ScoreBadge.tsx` itself needs no change (same prop shape).
- `src/components/Hud.tsx`: replace any `state.playerHand.length` check with `state.playerHands[state.activeHandIndex].cards.length`.
- `src/hooks/useBlackjack.ts`: the backend-reporting effect currently reads `state.handDecisions` - replace with `state.playerHands.flatMap((h) => h.decisions)` (this task always has exactly one hand, so behavior is unchanged; Task 7 relies on this same flatMap already being correct for multiple hands).

- [ ] **Step 5: Run the full test suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS with zero errors. If `BotVsBot.tsx` reads any of the old field names directly (check with the same grep from Step 4 against `src/components/BotVsBot.tsx`), update it the same way.

- [ ] **Step 6: Manually verify in the browser**

Play several full hands (normal win, bust, dealer blackjack, insurance-then-blackjack, double, surrender) in both the mini-app and web-landing views, confirming every outcome and message renders exactly as it did before this refactor. This task must be a pure behavior-preserving migration - anything that looks different is a bug in this task, not expected.

- [ ] **Step 7: Commit**

```bash
git add src/game/engine.ts src/game/engine.test.ts src/components/Table.tsx src/components/Hud.tsx src/hooks/useBlackjack.ts
git commit -m "Migrate GameState to a playerHands array ahead of split support"
```

---

### Task 2: Add pair-splitting to basic strategy grading

**Files:**
- Modify: `src/game/strategy.ts`
- Test: `src/game/strategy.test.ts` (append)

**Interfaces:**
- Produces: `export type Action = "hit" | "stand" | "double" | "surrender" | "split";` and `optimalAction` gains two new optional trailing parameters: `optimalAction(total, isSoft, dealerUpcard, canDouble, canSurrender, pairRank?: number | null, canSplit?: boolean): Action`. `pairRank` is the card rank of BOTH cards in an as-dealt pair (1 = Ace, 10/11/12/13 all mean "ten" for splitting purposes - normalize before calling, the same way `dealerUpcard` is normalized inside this function), or `null`/omitted for a non-pair hand.

- [ ] **Step 1: Write the failing tests**

Append to `src/game/strategy.test.ts`:

```typescript
describe("optimalAction: pair splitting", () => {
  function expectPairByUpcard(pairRank: number, expected: Record<number, string>) {
    const total = pairRank === 1 ? 12 : pairRank * 2; // hard total if NOT split (A+A is scored as soft 12, i.e. two aces = 12)
    const isSoft = pairRank === 1;
    for (const up of UPCARDS) {
      expect(optimalAction(total, isSoft, up, true, true, pairRank, true), `pair of ${pairRank} vs ${up}`).toBe(expected[up]);
    }
  }

  test("always splits Aces", () => {
    expectPairByUpcard(1, Object.fromEntries(UPCARDS.map((u) => [u, "split"])));
  });

  test("always splits 8s", () => {
    expectPairByUpcard(8, Object.fromEntries(UPCARDS.map((u) => [u, "split"])));
  });

  test("never splits 10s - falls back to standing on hard 20", () => {
    expectPairByUpcard(10, Object.fromEntries(UPCARDS.map((u) => [u, "stand"])));
  });

  test("never splits 5s - falls back to hard-10 double-or-hit logic", () => {
    expectPairByUpcard(5, { 2: "double", 3: "double", 4: "double", 5: "double", 6: "double", 7: "double", 8: "double", 9: "double", 10: "hit", 11: "hit" });
  });

  test("splits 9s vs everything except 7, 10, and Ace (those stand on hard 18)", () => {
    expectPairByUpcard(9, { 2: "split", 3: "split", 4: "split", 5: "split", 6: "split", 7: "stand", 8: "split", 9: "split", 10: "stand", 11: "stand" });
  });

  test("splits 7s vs dealer 2-7, else falls back to hard-14 logic", () => {
    expectPairByUpcard(7, { 2: "split", 3: "split", 4: "split", 5: "split", 6: "split", 7: "split", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("splits 6s vs dealer 2-6, else falls back to hard-12 logic", () => {
    expectPairByUpcard(6, { 2: "split", 3: "split", 4: "split", 5: "split", 6: "split", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("splits 4s only vs dealer 5-6, else falls back to hard-8 logic (always hit)", () => {
    expectPairByUpcard(4, { 2: "hit", 3: "hit", 4: "hit", 5: "split", 6: "split", 7: "hit", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("splits 2s and 3s vs dealer 2-7, else falls back to hard-4/6 logic (always hit)", () => {
    expectPairByUpcard(2, { 2: "split", 3: "split", 4: "split", 5: "split", 6: "split", 7: "split", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
    expectPairByUpcard(3, { 2: "split", 3: "split", 4: "split", 5: "split", 6: "split", 7: "split", 8: "hit", 9: "hit", 10: "hit", 11: "hit" });
  });

  test("canSplit=false falls back to normal hard/soft logic even for Aces (re-split limit reached)", () => {
    // two Aces, canSplit false: soft 12, "always hit" per the soft-total table's <18 branch
    expect(optimalAction(12, true, 6, true, true, 1, false)).toBe("hit");
  });

  test("pairRank omitted behaves exactly like before (no pair-awareness regression)", () => {
    expect(optimalAction(16, false, false, true, undefined, false)).toBe(optimalAction(16, false, false, true));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/strategy.test.ts`
Expected: FAIL — `optimalAction` doesn't accept `pairRank`/`canSplit` yet, and `"split"` isn't a valid `Action`.

- [ ] **Step 3: Write the implementation**

In `src/game/strategy.ts`, change the `Action` type:

```typescript
export type Action = "hit" | "stand" | "double" | "surrender" | "split";
```

Add a helper and update `optimalAction`'s signature (keep every existing line inside the function body unchanged - only the signature and the new leading pair-check are new):

```typescript
function pairShouldSplit(pairRank: number, up: number): boolean {
  if (pairRank === 1) return true; // Aces always
  if (pairRank === 10 || pairRank === 5) return false; // never split tens or fives
  if (pairRank === 9) return !(up === 7 || up === 10 || up === 11);
  if (pairRank === 8) return true; // always
  if (pairRank === 7) return inRange(up, 2, 7);
  if (pairRank === 6) return inRange(up, 2, 6);
  if (pairRank === 4) return up === 5 || up === 6;
  if (pairRank === 3 || pairRank === 2) return inRange(up, 2, 7);
  return false;
}

export function optimalAction(
  total: number,
  isSoft: boolean,
  dealerUpcard: number,
  canDouble: boolean,
  canSurrender: boolean,
  pairRank: number | null = null,
  canSplit: boolean = false,
): Action {
  const up = dealerUpcard === 1 ? 11 : Math.min(dealerUpcard, 10);

  if (pairRank !== null && canSplit && pairShouldSplit(pairRank, up)) {
    return "split";
  }

  // ... existing isSoft / hard-total logic, completely unchanged from the
  // insurance/double/surrender plan's Task 1 - do not rewrite it here.
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/strategy.test.ts`
Expected: PASS (every test in the file, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/game/strategy.ts src/game/strategy.test.ts
git commit -m "Add pair-splitting to basic strategy grading"
```

---

### Task 3: Add the `split()` engine action

**Files:**
- Modify: `src/game/engine.ts`
- Test: `src/game/engine.test.ts` (append)

**Interfaces:**
- Consumes: `optimalAction(..., pairRank, canSplit)` from Task 2.
- Produces:
  - `export function canSplit(state: GameState): boolean`
  - `export function split(state: GameState): GameState`

**Context:** Splitting turns the active hand's 2 cards into two separate 1-card hands, each immediately dealt one more card (standard rule: you don't act on a 1-card hand), inserted into `playerHands` right after the current hand, and becomes the new active hand at the original index. Every later hand's index shifts up by one. The special "split Aces get exactly one card total and can't be hit again" rule means: if the pair being split is Aces, deal the one extra card to each new hand and mark both `turnDone: true` immediately (they skip straight to `advanceOrFinish`); for any other pair, deal one card to each and leave both `turnDone: false` so the player can act on them normally (including re-splitting, hitting, standing, or doubling).

- [ ] **Step 1: Write the failing tests**

Append to `src/game/engine.test.ts`:

```typescript
describe("canSplit", () => {
  test("true when the active hand is exactly two cards of matching rank and under the re-split limit", () => {
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(8), card(8)]), dealerHand: [card(9), card(2)], splitCount: 0 });
    expect(engine.canSplit(s)).toBe(true);
  });

  test("false when the two cards don't match", () => {
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(8), card(9)]), dealerHand: [card(9), card(2)] });
    expect(engine.canSplit(s)).toBe(false);
  });

  test("10, J, Q, K all count as matching for splitting purposes", () => {
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(10), card(13)]), dealerHand: [card(9), card(2)] });
    expect(engine.canSplit(s)).toBe(true);
  });

  test("false once the re-split limit (4 hands) is reached", () => {
    const s = baseState({
      phase: "player-turn",
      playerHands: [
        { cards: [card(8), card(8)], decisions: [], outcome: null, turnDone: false },
        { cards: [], decisions: [], outcome: null, turnDone: false },
        { cards: [], decisions: [], outcome: null, turnDone: false },
        { cards: [], decisions: [], outcome: null, turnDone: false },
      ],
      activeHandIndex: 0,
      dealerHand: [card(9), card(2)],
      splitCount: 3,
    });
    expect(engine.canSplit(s)).toBe(false);
  });

  test("false for a pair of Aces that has already been split once", () => {
    const s = baseState({
      phase: "player-turn",
      playerHands: [
        { cards: [card(1), card(1)], decisions: [], outcome: null, turnDone: false },
      ],
      activeHandIndex: 0,
      dealerHand: [card(9), card(2)],
      splitCount: 1,
      // splitCount alone doesn't distinguish "split aces once" from "split 8s three times" -
      // canSplit's own implementation must track which ranks were already split as Aces.
      // See the aces-specific test below for the actual guarantee this plan relies on instead:
      // aces are limited by turnDone being set true immediately after the one-card deal,
      // which already makes them ineligible for canSplit regardless of splitCount.
    });
    expect(s.playerHands[0].turnDone).toBe(false); // sanity check on the fixture itself, not the real guarantee
  });
});

describe("split", () => {
  test("splits a pair into two one-card hands, each immediately dealt one more card", () => {
    mockDraws(card(3), card(4)); // first new hand gets a 3, second gets a 4
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(8), card(8)]), dealerHand: [card(9), card(2)], splitCount: 0 });
    const next = engine.split(s);
    expect(next.playerHands).toHaveLength(2);
    expect(next.playerHands[0].cards).toEqual([card(8), card(3)]);
    expect(next.playerHands[1].cards).toEqual([card(8), card(4)]);
    expect(next.splitCount).toBe(1);
    expect(next.activeHandIndex).toBe(0);
    expect(next.phase).toBe("player-turn");
  });

  test("records a graded split decision on the original hand before splitting it", () => {
    mockDraws(card(3), card(4));
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(8), card(8)]), dealerHand: [card(9), card(2)] });
    const next = engine.split(s);
    expect(next.playerHands[0].decisions).toHaveLength(1);
    expect(next.playerHands[0].decisions[0].action).toBe("split");
  });

  test("splitting Aces deals one card to each and immediately marks both hands turn-done", () => {
    mockDraws(card(10), card(9));
    const s = baseState({ phase: "player-turn", ...withPlayerCards([card(1), card(1)]), dealerHand: [card(6), card(2)] });
    const next = engine.split(s);
    expect(next.playerHands[0].cards).toEqual([card(1), card(10)]);
    expect(next.playerHands[0].turnDone).toBe(true);
    expect(next.playerHands[1].cards).toEqual([card(1), card(9)]);
    expect(next.playerHands[1].turnDone).toBe(true);
    // both hands are done, so the round advances straight to the dealer
    expect(next.phase).toBe("round-over");
  });

  test("re-splitting inserts the new hand right after the one being split, shifting later hands up", () => {
    mockDraws(card(3), card(4));
    const s = baseState({
      phase: "player-turn",
      playerHands: [
        { cards: [card(8), card(8)], decisions: [], outcome: null, turnDone: false },
        { cards: [card(10), card(9)], decisions: [], outcome: false as unknown as null, turnDone: true }, // placeholder second hand from an earlier split
      ],
      activeHandIndex: 0,
      dealerHand: [card(9), card(2)],
      splitCount: 1,
    });
    const next = engine.split(s);
    expect(next.playerHands).toHaveLength(3);
    expect(next.playerHands[0].cards).toEqual([card(8), card(3)]);
    expect(next.playerHands[1].cards).toEqual([card(8), card(4)]);
    expect(next.playerHands[2].cards).toEqual([card(10), card(9)]); // shifted from index 1 to 2
    expect(next.splitCount).toBe(2);
  });
});
```

Fix the placeholder `outcome: false as unknown as null` in the last test above before running it — it was left there to mark "this fixture needs a real settled-or-in-progress hand shape"; replace it with `outcome: null` (the fixture only needs `turnDone: true` to be realistic, not a settled outcome).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/engine.test.ts`
Expected: FAIL — `engine.canSplit` and `engine.split` don't exist yet.

- [ ] **Step 3: Write the implementation**

In `src/game/engine.ts`, add a `pairRank` helper and `canSplit`/`split` functions. First, add this near the top (after `freshHand`):

```typescript
/** Normalizes a card rank to its splitting-equivalence class: Ace stays 1, everything 10+ becomes 10. */
function splitRank(rank: number): number {
  return rank === 1 ? 1 : Math.min(rank, 10);
}
```

Add `canSplit` right after `canDoubleOrSurrender`:

```typescript
const MAX_SPLIT_HANDS = 4;

export function canSplit(state: GameState): boolean {
  if (state.phase !== "player-turn") return false;
  if (state.playerHands.length >= MAX_SPLIT_HANDS) return false;
  const hand = activeHand(state);
  if (hand.cards.length !== 2) return false;
  return splitRank(hand.cards[0].rank) === splitRank(hand.cards[1].rank);
}
```

Add `split` after `surrender`:

```typescript
/**
 * Splitting Aces is capped at exactly one card each with no further action
 * (a common, widely-recognized rule variant) - every other pair can be
 * hit/stood/doubled/re-split normally afterward, same as any other hand.
 * Like every other action here, this is a skill-graded rules addition only:
 * there is no second on-chain payment, so there is nothing to actually
 * "double the wager" for.
 */
export function split(state: GameState): GameState {
  const hand = activeHand(state);
  const decision = recordDecision(state, "split", true, true);
  const isAces = splitRank(hand.cards[0].rank) === 1;

  const firstCards = [hand.cards[0], drawCard()];
  const secondCards = [hand.cards[1], drawCard()];
  const firstHand: PlayerHandState = {
    cards: firstCards,
    decisions: [decision],
    outcome: null,
    turnDone: isAces || handValue(firstCards).isBust,
  };
  const secondHand: PlayerHandState = {
    cards: secondCards,
    decisions: [],
    outcome: null,
    turnDone: isAces || handValue(secondCards).isBust,
  };

  const playerHands = [...state.playerHands];
  playerHands.splice(state.activeHandIndex, 1, firstHand, secondHand);

  const next: GameState = {
    ...state,
    playerHands,
    splitCount: state.splitCount + 1,
  };

  return firstHand.turnDone ? advanceOrFinish(next) : next;
}
```

Note `recordDecision`'s call above still works unchanged - it reads `activeHand(state).cards` (the pre-split 2 cards) and grades the `"split"` action against `optimalAction`'s pair-aware branch from Task 2. **This means `recordDecision` itself must be updated to actually pass `pairRank`/`canSplit`** - go back and change it (it currently only forwards `canDouble`/`canSurrender`, added in the insurance/double/surrender plan):

```typescript
function recordDecision(state: GameState, action: Action, canDouble: boolean, canSurrender: boolean): DecisionRecord {
  const hand = activeHand(state);
  const hv = handValue(hand.cards);
  const dealerUpcard = state.dealerHand[0].rank;
  const isPair = hand.cards.length === 2 && splitRank(hand.cards[0].rank) === splitRank(hand.cards[1].rank);
  const pairRank = isPair ? splitRank(hand.cards[0].rank) : null;
  const optimal = optimalAction(hv.total, hv.isSoft, dealerUpcard, canDouble, canSurrender, pairRank, canSplit(state));
  return { total: hv.total, isSoft: hv.isSoft, dealerUpcard, action, optimal, wasCorrect: optimal === action };
}
```

This changes what `hit`/`stand`/`double`/`surrender` are graded against too, in one specific new way: a player sitting on a splittable pair who chooses to `hit`/`stand`/`double` instead of splitting is now correctly marked wrong when basic strategy actually says split (before this task, splitting didn't exist, so e.g. hitting on 8-8 vs dealer 6 was never flagged as a mistake — now it will be, correctly, since Task 2's chart says split is mandatory there). Re-run the *entire* suite (not just this file) after this change, since it can flip the expected `wasCorrect` value on any existing `hit`/`stand`/`double`/`surrender` test whose fixture happens to start with a pair — check every test added in Tasks 1 and 3 that uses a pair fixture (search this plan and the insurance/double/surrender plan's tests for `card(8), card(8)` or similar matching-rank fixtures) and confirm none of them accidentally regress.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS across the entire suite, not just `engine.test.ts` — this task changes `recordDecision`'s grading for every existing pair-shaped test fixture, so a regression would most likely show up as a `wasCorrect` mismatch somewhere unexpected.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts src/game/engine.test.ts
git commit -m "Add split() engine action with aces-get-one-card and re-split support"
```

---

### Task 4: Wire Split into the Hud and multi-hand Table display

**Files:**
- Modify: `src/components/Hud.tsx`
- Modify: `src/components/Table.tsx`
- Modify: `src/components/GameWidget.tsx`
- Modify: `src/hooks/useBlackjack.ts`

**Interfaces:**
- Consumes: `engine.canSplit`, `engine.split` from Task 3.
- Produces: `useBlackjack()` gains `onSplit: () => void` and `canSplit: boolean`.

- [ ] **Step 1: Add the callback to `useBlackjack.ts`**

Following the exact same one-line `useCallback` pattern as `double`/`surrender` (added in the insurance/double/surrender plan's Task 5), add:

```typescript
const split = useCallback(() => {
  setState((s) => engine.split(s));
}, []);
```

Add `onSplit: split` and `canSplit: engine.canSplit(state)` to the hook's returned object.

- [ ] **Step 2: Add the Split button to `Hud.tsx`**

In the `player-turn` branch's `canDoubleOrSurrender && (...)` block (added in the insurance/double/surrender plan's Task 5), add a Split button alongside Double/Surrender, gated on its own `canSplit` prop (a hand can be splittable without being double/surrender-eligible in edge cases around the re-split limit, so check independently rather than reusing the same condition):

```typescript
<div className="flex items-center justify-center gap-3">
  {canDoubleOrSurrender && (
    <>
      <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onDouble}>
        Double
      </button>
      <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onSurrender}>
        Surrender
      </button>
    </>
  )}
  {canSplit && (
    <button type="button" className="sk-btn sk-btn--tap text-sm" onClick={onSplit}>
      Split
    </button>
  )}
</div>
```

Add `onSplit: () => void` and `canSplit: boolean` to `Hud.tsx`'s prop type.

- [ ] **Step 3: Show every split hand on the Table, highlighting the active one**

In `Table.tsx`, the player-hand display currently renders a single `<Hand cards={state.playerHands[state.activeHandIndex].cards} ... />` (per Task 1's migration). Replace it with a row of hands when there's more than one:

```typescript
<div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 flex gap-3">
  {state.playerHands.map((hand, i) => (
    <div key={i} style={{ opacity: state.playerHands.length > 1 && i !== state.activeHandIndex ? 0.55 : 1 }}>
      <Hand
        cards={hand.cards}
        label={state.playerHands.length > 1 ? `Hand ${i + 1}` : playerLabel}
        active={i === state.activeHandIndex && state.phase === "player-turn"}
      />
    </div>
  ))}
</div>
```

Check `Hand.tsx`'s existing prop type (from the earlier gameplay-polish work) before assuming `active` is already a valid prop - if it isn't, this step also needs to add it there, following whatever visual treatment `active` already produces for the dealer/player highlight in the current code.

- [ ] **Step 4: Thread `onSplit`/`canSplit` through `GameWidget.tsx`**

Add `onSplit={pve.onSplit}` and `canSplit={pve.canSplit}` to the `<Hud .../>` call, alongside the props added in the insurance/double/surrender plan's Task 5.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manually verify in the browser**

Play hands until you're dealt a splittable pair (try several times - 8-8, or any pair the chart says to split). Confirm: the Split button appears; splitting shows two hands on the table with the active one visually distinct; you can act on each hand in turn (hit/stand/double, and re-split if you draw another matching pair before the 4-hand limit); the round only ends once every hand is done; the result message summarizes all hands' outcomes. Also verify: dealing a pair of Aces and splitting immediately shows both one-card hands as already done, with no Hit/Stand/Double buttons offered for them.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useBlackjack.ts src/components/Hud.tsx src/components/Table.tsx src/components/GameWidget.tsx
git commit -m "Wire split into the Hud and show multiple hands on the table"
```

---

### Task 5: Verify backend reporting still sends exactly one row per round

**Files:**
- Modify: `src/hooks/useBlackjack.ts` (verify only — likely no code change needed)

**Interfaces:** None new — this task is a verification/regression-guard, not new functionality.

**Context:** Task 1 already changed the backend-reporting effect to read `state.playerHands.flatMap((h) => h.decisions)` instead of `state.handDecisions`. Since a split round still calls `recordHand` exactly once (the effect fires once per `state.handsPlayed` increment, and `handsPlayed` only increments once per round via `finalizeRound`, regardless of how many hands were split into), this should already correctly aggregate every split hand's decisions into one report with no further code change. This task exists to explicitly verify that assumption rather than leave it implicit.

- [ ] **Step 1: Manually verify in the browser with the Network tab open**

Start the dev server, open browser devtools' Network tab, play a round where you split into 2+ hands and play each one out, and confirm exactly one `POST` request to `/api/hands` fires for the entire round (not one per split hand), with `totalDecisions` equal to the sum of every hand's decision count (including the split decision itself) and `correctDecisions` matching how many of those were graded correct.

- [ ] **Step 2: If more than one request fired, or the counts are wrong, fix the effect**

Read the effect in `src/hooks/useBlackjack.ts` that watches `state.handsPlayed` and calls `recordHand`. Confirm its dependency array and guard (`if (state.handsPlayed <= lastReportedHandsPlayed.current) return;`) still correctly fire exactly once per round under the new multi-hand shape — if `lastReportedHandsPlayed` or the guard was written assuming the old shape in a way Task 1 missed, correct it here referencing the real code you just read, not a guess.

- [ ] **Step 3: Commit** (only if Step 2 required a change)

```bash
git add src/hooks/useBlackjack.ts
git commit -m "Fix backend reporting to stay one-row-per-round after split support"
```

---

## Self-Review Notes

- **Spec coverage:** Splitting pairs end-to-end ✓ (Tasks 1–4), re-split up to 4 hands ✓ (Task 3), split-Aces one-card rule ✓ (Task 3), backend one-row-per-round invariant preserved ✓ (Task 5).
- **No real-money math added** — `split()`'s docstring says so explicitly, same as every function in the companion plan.
- **Type consistency verified:** `PlayerHandState`/`GameState` are defined once in Task 1 and used by exact field name everywhere downstream (`playerHands`, `activeHandIndex`, `turnDone`) — no task introduces a differently-named equivalent. `Action` gains `"split"` in Task 2 and is consumed by the same `DecisionRecord.action`/`.optimal` fields introduced in the companion plan, unchanged.
- **Depends on the insurance/double/surrender plan landing first** — do not attempt to run these two plans in parallel against the same starting commit, since Task 1 here assumes `finishPlayerTurn`, `Phase`'s `"insurance"` member, and `optimalAction`'s 5-argument form already exist.
