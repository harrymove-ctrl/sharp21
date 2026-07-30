import { useState } from "react";
import { BET_OPTIONS, type GameState } from "../game/engine";
import type { PaymentStatus } from "../hooks/useBlackjack";
import { Chip } from "./Chip";
import { ScanToPay } from "./ScanToPay";

// Must match Table.tsx's reveal-choreography constants so "Deal again"
// fades in around the same moment the result panel finishes appearing,
// instead of sitting there clickable while the felt is still revealing.
const HOLE_FLIP_MS = 420;
const CATCH_UP_STAGGER_MS = 240;

export function Hud({
  state,
  payment,
  onBet,
  onHit,
  onStand,
  onDeal,
  onDismissPaymentError,
  usingScanToPay,
  onScannedPaid,
}: {
  state: GameState;
  payment: PaymentStatus;
  onBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDeal: () => void;
  onDismissPaymentError: () => void;
  /** Once a scan-to-pay payment has been made, every hand's entry fee goes
   *  through the QR flow instead of the in-app chip-tap flow, so betting
   *  renders ScanToPay here rather than the normal chip row. */
  usingScanToPay: boolean;
  onScannedPaid: (payment: { wagerLuna: number; txHash: string; senderAddress: string }) => void;
}) {
  // Bumped on every click so a fresh <span> mounts each time, replaying the
  // tap-ripple animation - a stronger, click-tied response than the
  // existing generic hover lift.
  const [hitPulse, setHitPulse] = useState(0);
  const [standPulse, setStandPulse] = useState(0);

  if (state.phase === "betting") {
    if (usingScanToPay) {
      return <ScanToPay onPaid={onScannedPaid} />;
    }

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
        <button
          className="sk-btn sk-btn--primary sk-btn--tap relative"
          onClick={() => {
            setHitPulse((p) => p + 1);
            onHit();
          }}
        >
          Hit
          {hitPulse > 0 && <span key={hitPulse} className="sk-btn-ripple" aria-hidden="true" />}
        </button>
        <button
          className="sk-btn sk-btn--amber sk-btn--tap relative"
          onClick={() => {
            setStandPulse((p) => p + 1);
            onStand();
          }}
        >
          Stand
          {standPulse > 0 && <span key={standPulse} className="sk-btn-ripple" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  if (state.phase === "round-over") {
    const dealerExtraCards = Math.max(0, state.dealerHand.length - 2);
    const revealHoldMs = HOLE_FLIP_MS + dealerExtraCards * CATCH_UP_STAGGER_MS;
    return (
      <div className="flex items-center justify-center py-4">
        <button
          className="sk-btn sk-btn--primary sk-btn--tap sk-enter-fade"
          style={{ animationDelay: `${revealHoldMs + 150}ms` }}
          onClick={onDeal}
        >
          Deal again
        </button>
      </div>
    );
  }

  return (
    <div className="py-4 flex items-center justify-center gap-2 sk-eyebrow text-xs opacity-60">
      <span className="sk-turn-dot" aria-hidden="true" />
      Dealer playing…
    </div>
  );
}
