import type { CSSProperties } from "react";
import { type PlayingCard, isRed, rankLabel, suitGlyph } from "../game/cards";

export function Card({
  card,
  faceDown,
  style,
  animationDelayMs = 0,
  flipReveal,
  hitBadge,
}: {
  card?: PlayingCard;
  faceDown?: boolean;
  style?: CSSProperties;
  /** Delay before this card's mount animation starts - lets a hand's cards
   *  deal in as a sequence even though they can arrive in the same render. */
  animationDelayMs?: number;
  /** True for the dealer's hole card at the exact moment it's revealed -
   *  swaps the plain deal-in animation for a card-flip so the reveal reads
   *  as "this was hidden, now shown" rather than just another new card. */
  flipReveal?: boolean;
  /** Small corner tag ("+1", "+2", ...) marking a card drawn beyond the
   *  original two, so a long hand reads as a sequence of choices. */
  hitBadge?: string;
}) {
  const wrapperStyle: CSSProperties = { ...style, animationDelay: `${animationDelayMs}ms` };
  return (
    <div className={`relative ${flipReveal ? "sk-card-flip" : "sk-card-deal"}`} style={wrapperStyle}>
      {faceDown || !card ? (
        <div className="sk-card sk-card--back" title="Hidden until you finish your turn">
          <span className="sk-card-back-mark" aria-hidden="true">
            ?
          </span>
        </div>
      ) : (
        <div className={`sk-card ${isRed(card.suit) ? "sk-card--red" : ""}`}>
          {rankLabel(card.rank)}
          {suitGlyph(card.suit)}
        </div>
      )}
      {hitBadge && (
        <span className="sk-hit-badge" aria-hidden="true">
          {hitBadge}
        </span>
      )}
    </div>
  );
}
