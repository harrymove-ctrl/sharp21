import { BET_OPTIONS, type GameState } from "../game/engine";
import { Chip } from "./Chip";

export function Hud({
  state,
  onBet,
  onHit,
  onStand,
  onDeal,
}: {
  state: GameState;
  onBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDeal: () => void;
}) {
  if (state.phase === "betting") {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        {BET_OPTIONS.map((amount) => (
          <Chip key={amount} value={amount} onClick={() => onBet(amount)} />
        ))}
      </div>
    );
  }

  if (state.phase === "player-turn") {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <button className="sk-btn sk-btn--primary" onClick={onHit}>
          Hit
        </button>
        <button className="sk-btn sk-btn--amber" onClick={onStand}>
          Stand
        </button>
      </div>
    );
  }

  if (state.phase === "round-over") {
    return (
      <div className="flex items-center justify-center py-4">
        <button className="sk-btn sk-btn--primary" onClick={onDeal}>
          Deal again
        </button>
      </div>
    );
  }

  return <div className="py-4 text-center sk-eyebrow text-xs opacity-60">Dealer playing…</div>;
}
