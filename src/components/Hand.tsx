import { type PlayingCard, handValue } from "../game/cards";
import { Card } from "./Card";

// Must stay in step with Table.tsx's HOLE_FLIP_MS / CATCH_UP_STAGGER_MS -
// this file times the individual cards, Table.tsx times the "Dealer
// reveals..." caption and the result panel around the same reveal moment.
const DEAL_STAGGER_MS = 130;
const HOLE_FLIP_MS = 420;
const CATCH_UP_STAGGER_MS = 240;

export function Hand({
  cards,
  hideSecond,
  label,
  isDealer,
  active,
  turnNote,
  revealNote,
}: {
  cards: PlayingCard[];
  hideSecond?: boolean;
  label: string;
  /** Enables the hole-card flip-reveal animation and the dealer catch-up
   *  stagger for cards drawn beyond the original two. */
  isDealer?: boolean;
  /** True while this hand currently has the turn - draws a subtle glow. */
  active?: boolean;
  /** Persistent short status shown next to the hand, e.g. "Your turn" or
   *  "Waiting - 1 card hidden". */
  turnNote?: string;
  /** Transient caption (dealer only) that fades in, holds, then fades out
   *  on its own timeline while the hole card/catch-up cards animate. */
  revealNote?: { text: string; durationMs: number };
}) {
  const visibleCards = hideSecond ? cards.slice(0, 1) : cards;
  const hv = cards.length > 0 && !hideSecond ? handValue(cards) : null;
  const cardCount = visibleCards.length + (hideSecond && cards.length > 1 ? 1 : 0);
  const overlap = cardCount > 4;

  // index 0-1: the original two cards, staggered as a simultaneous deal.
  // index 2+ for the dealer at reveal time: cards drawn to reach 17, all
  //   arriving in the same render, staggered after the hole-card flip.
  // index 2+ otherwise: a single card the player just chose to hit -
  //   it's the only new card mounting, so it animates immediately.
  const cardDelayMs = (i: number) => {
    if (i <= 1) return i * DEAL_STAGGER_MS;
    if (isDealer && !hideSecond) return HOLE_FLIP_MS + (i - 2) * CATCH_UP_STAGGER_MS;
    return 0;
  };

  return (
    <div className={`flex flex-col items-center gap-1 ${active ? "sk-hand-active" : ""}`}>
      {turnNote && (
        <div className={`sk-turn-badge ${isDealer ? "sk-turn-badge--dealer" : "sk-turn-badge--player"}`}>
          {!isDealer && <span className="sk-turn-dot" aria-hidden="true" />}
          {turnNote}
        </div>
      )}
      {revealNote && (
        <div
          className="sk-turn-badge sk-turn-badge--dealer sk-caption-timed"
          style={{ animationDuration: `${revealNote.durationMs}ms` }}
        >
          {revealNote.text}
        </div>
      )}
      <div className="flex gap-1.5">
        {visibleCards.map((c, i) => (
          <Card
            key={i}
            card={c}
            style={overlap && i > 0 ? { marginLeft: "-2.1rem" } : undefined}
            animationDelayMs={cardDelayMs(i)}
            flipReveal={isDealer && i === 1 && !hideSecond}
            hitBadge={i >= 2 ? `+${i - 1}` : undefined}
          />
        ))}
        {hideSecond && cards.length > 1 && (
          <Card
            faceDown
            style={overlap ? { marginLeft: "-2.1rem" } : undefined}
            animationDelayMs={DEAL_STAGGER_MS}
          />
        )}
      </div>
      <div className="sk-eyebrow text-xs">
        {label}
        {hv ? ` · ${hv.total}${hv.isSoft ? " (soft)" : ""}` : ""}
      </div>
    </div>
  );
}
