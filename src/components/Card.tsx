import type { CSSProperties } from "react";
import { type PlayingCard, isRed, rankLabel, suitGlyph } from "../game/cards";

export function Card({
  card,
  faceDown,
  style,
}: {
  card?: PlayingCard;
  faceDown?: boolean;
  style?: CSSProperties;
}) {
  if (faceDown || !card) {
    return <div className="sk-card sk-card--back" style={style} />;
  }
  return (
    <div className={`sk-card ${isRed(card.suit) ? "sk-card--red" : ""}`} style={style}>
      {rankLabel(card.rank)}
      {suitGlyph(card.suit)}
    </div>
  );
}
