export type Action = "hit" | "stand";

/**
 * Simplified basic strategy for a hit/stand-only variant (no double/split
 * available). Where standard basic strategy would double, the
 * strategy-equivalent action here is whatever basic strategy falls back to
 * without doubling — verified per-case below, not just "always hit".
 */
export function optimalAction(total: number, isSoft: boolean, dealerUpcard: number): Action {
  const up = dealerUpcard === 1 ? 11 : Math.min(dealerUpcard, 10); // ace high, 10/J/Q/K = 10

  if (isSoft) {
    if (total <= 17) return "hit";
    if (total === 18) return up >= 9 ? "hit" : "stand";
    return "stand"; // soft 19+
  }

  if (total <= 11) return "hit";
  if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
  if (total >= 13 && total <= 16) return up >= 2 && up <= 6 ? "stand" : "hit";
  return "stand"; // hard 17+
}
