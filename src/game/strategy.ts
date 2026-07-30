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
    if (total <= 12) return "hit"; // A,A before any split (pair-splitting isn't implemented yet)
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
