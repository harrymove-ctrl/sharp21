import { type PlayingCard, isRed, rankLabel, suitGlyph } from "../game/cards";

export function Card({ card, faceDown }: { card?: PlayingCard; faceDown?: boolean }) {
  if (faceDown || !card) {
    return <div className="sk-card sk-card--back" />;
  }
  return (
    <div className={`sk-card ${isRed(card.suit) ? "sk-card--red" : ""}`}>
      {rankLabel(card.rank)}
      {suitGlyph(card.suit)}
    </div>
  );
}
