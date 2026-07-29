import { BET_OPTIONS, type GameState } from "../game/engine";
import type { PaymentStatus } from "../hooks/useBlackjack";
import { Chip } from "./Chip";

export function Hud({
  state,
  payment,
  onBet,
  onHit,
  onStand,
  onDeal,
  onDismissPaymentError,
}: {
  state: GameState;
  payment: PaymentStatus;
  onBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDeal: () => void;
  onDismissPaymentError: () => void;
}) {
  if (state.phase === "betting") {
    if (payment.kind === "pending") {
      return (
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="sk-eyebrow text-[0.6rem] opacity-80">Confirm the payment in your wallet…</div>
          <div className="flex items-center justify-center gap-3">
            {BET_OPTIONS.map((amount) => (
              <Chip key={amount} value={amount} disabled />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-1 py-2">
        {payment.kind === "error" ? (
          <button
            type="button"
            className="sk-eyebrow text-[0.6rem]"
            style={{ color: "var(--sk-red)" }}
            onClick={onDismissPaymentError}
          >
            {payment.message} — tap a chip to try again
          </button>
        ) : (
          <div className="sk-eyebrow text-[0.6rem] opacity-80">Entry fee, in NIM</div>
        )}
        <div className="flex items-center justify-center gap-3">
          {BET_OPTIONS.map((amount) => (
            <Chip key={amount} value={amount} onClick={() => onBet(amount)} />
          ))}
        </div>
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
