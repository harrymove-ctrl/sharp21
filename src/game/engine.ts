import { type PlayingCard, drawCard, handValue } from "./cards";
import { optimalAction, type Action } from "./strategy";

export type Phase = "betting" | "player-turn" | "dealer-turn" | "round-over";
export type Outcome = "win" | "lose" | "push";

export interface DecisionRecord {
  total: number;
  isSoft: boolean;
  dealerUpcard: number;
  action: Action;
  optimal: Action;
  wasCorrect: boolean;
}

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
}

export const BET_OPTIONS = [1, 2, 5] as const;

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
  };
}

function recordDecision(state: GameState, action: Action): DecisionRecord {
  const hv = handValue(state.playerHand);
  const dealerUpcard = state.dealerHand[0].rank;
  const optimal = optimalAction(hv.total, hv.isSoft, dealerUpcard, false, false);
  return { total: hv.total, isSoft: hv.isSoft, dealerUpcard, action, optimal, wasCorrect: optimal === action };
}

export function placeBet(state: GameState, wager: number): GameState {
  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];
  let next: GameState = {
    ...state,
    phase: "player-turn",
    wager,
    playerHand,
    dealerHand,
    dealerHoleHidden: true,
    outcome: null,
    lastMessage: null,
    handDecisions: [],
  };

  if (handValue(playerHand).isBlackjack || handValue(dealerHand).isBlackjack) {
    next = { ...next, dealerHoleHidden: false };
    return settle(next);
  }
  return next;
}

export function hit(state: GameState): GameState {
  const decision = recordDecision(state, "hit");
  const playerHand = [...state.playerHand, drawCard()];
  let next: GameState = { ...state, playerHand, handDecisions: [...state.handDecisions, decision] };
  if (handValue(playerHand).isBust) {
    next = { ...next, dealerHoleHidden: false };
    return settle(next);
  }
  return next;
}

export function stand(state: GameState): GameState {
  const decision = recordDecision(state, "stand");
  const next: GameState = {
    ...state,
    handDecisions: [...state.handDecisions, decision],
    dealerHoleHidden: false,
    phase: "dealer-turn",
  };
  return playDealerAndSettle(next);
}

function playDealerAndSettle(state: GameState): GameState {
  let dealerHand = [...state.dealerHand];
  while (handValue(dealerHand).total < 17) {
    dealerHand = [...dealerHand, drawCard()];
  }
  return settle({ ...state, dealerHand });
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

export function nextHand(state: GameState): GameState {
  return {
    ...initialState(),
    handsPlayed: state.handsPlayed,
    correctDecisions: state.correctDecisions,
    totalDecisions: state.totalDecisions,
  };
}
