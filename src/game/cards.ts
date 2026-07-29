export type Suit = "clubs" | "diamonds" | "hearts" | "spades";

export interface PlayingCard {
  rank: number; // 1-13, 1 = Ace, 11 = J, 12 = Q, 13 = K
  suit: Suit;
}

const SUITS: Suit[] = ["clubs", "diamonds", "hearts", "spades"];
const SUIT_GLYPH: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};
const RED_SUITS = new Set<Suit>(["diamonds", "hearts"]);

export function isRed(suit: Suit): boolean {
  return RED_SUITS.has(suit);
}

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPH[suit];
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

// Infinite deck with replacement (no shoe/penetration model).
export function drawCard(): PlayingCard {
  const rank = 1 + Math.floor(Math.random() * 13);
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit };
}

export function cardValue(rank: number): number {
  if (rank === 1) return 11; // ace, reduced later if needed
  if (rank >= 10) return 10;
  return rank;
}

export interface HandValue {
  total: number;
  isSoft: boolean; // true if an ace is still counted as 11
  isBust: boolean;
  isBlackjack: boolean; // natural 21 on the first two cards
}

export function handValue(cards: PlayingCard[]): HandValue {
  let total = cards.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let softAcesLeft = cards.filter((c) => c.rank === 1).length;
  while (total > 21 && softAcesLeft > 0) {
    total -= 10;
    softAcesLeft -= 1;
  }
  return {
    total,
    isSoft: softAcesLeft > 0,
    isBust: total > 21,
    isBlackjack: cards.length === 2 && total === 21,
  };
}
