import { type PlayingCard, handValue } from "../game/cards";
import { Card } from "./Card";

export function Hand({
  cards,
  hideSecond,
  label,
}: {
  cards: PlayingCard[];
  hideSecond?: boolean;
  label: string;
}) {
  const visibleCards = hideSecond ? cards.slice(0, 1) : cards;
  const hv = cards.length > 0 && !hideSecond ? handValue(cards) : null;
  const cardCount = visibleCards.length + (hideSecond && cards.length > 1 ? 1 : 0);
  const overlap = cardCount > 4;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1.5">
        {visibleCards.map((c, i) => (
          <Card key={i} card={c} style={overlap && i > 0 ? { marginLeft: "-2.1rem" } : undefined} />
        ))}
        {hideSecond && cards.length > 1 && (
          <Card faceDown style={overlap ? { marginLeft: "-2.1rem" } : undefined} />
        )}
      </div>
      <div className="sk-eyebrow text-xs">
        {label}
        {hv ? ` · ${hv.total}${hv.isSoft ? " (soft)" : ""}` : ""}
      </div>
    </div>
  );
}
