import type { GameState } from "../game/engine";
import { Hand } from "./Hand";
import { ScoreBadge } from "./ScoreBadge";

// Mirrors Hand.tsx's HOLE_FLIP_MS / CATCH_UP_STAGGER_MS so the "Dealer
// reveals..." caption and the result panel are timed around the same
// reveal choreography as the cards themselves.
const HOLE_FLIP_MS = 420;
const CATCH_UP_STAGGER_MS = 240;

export function Table({
  state,
  showScore = true,
  playerLabel = "You",
}: {
  state: GameState;
  showScore?: boolean;
  playerLabel?: string;
}) {
  const hasHand = state.playerHand.length > 0;

  // Whenever a hand ends, dealerHoleHidden has already flipped false and
  // (if the player stood below 21) the dealer may have already drawn its
  // catch-up cards - all in the same synchronous state update. These derive
  // a "how long would that have taken to deal out" duration purely for
  // pacing the reveal, without touching the underlying game logic at all.
  const dealerExtraCards = Math.max(0, state.dealerHand.length - 2);
  const revealHoldMs = HOLE_FLIP_MS + dealerExtraCards * CATCH_UP_STAGGER_MS;
  const resultDelayMs = revealHoldMs + 150;
  const outcomeColor =
    state.outcome === "win" ? "var(--sk-good)" : state.outcome === "lose" ? "var(--sk-red)" : "var(--sk-amber)";

  return (
    <div className="sk-felt relative h-full w-auto max-w-full aspect-[5/8] mx-auto rounded-[28px] overflow-hidden">
      {showScore && (
        <div className="absolute top-[3%] left-1/2 -translate-x-1/2">
          <ScoreBadge
            correct={state.correctDecisions}
            total={state.totalDecisions}
            hands={state.handsPlayed}
            lastDecision={state.handDecisions[state.handDecisions.length - 1]}
            decisionSeq={state.handDecisions.length}
          />
        </div>
      )}

      <div className={`absolute ${showScore ? "top-[28%]" : "top-[8%]"} left-1/2 -translate-x-1/2`}>
        {hasHand ? (
          <Hand
            cards={state.dealerHand}
            hideSecond={state.dealerHoleHidden}
            label="Dealer"
            isDealer
            turnNote={state.phase === "player-turn" ? "Waiting · 1 card hidden" : undefined}
            revealNote={
              state.phase === "round-over" ? { text: "Dealer reveals…", durationMs: revealHoldMs + 260 } : undefined
            }
          />
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">Dealer</div>
        )}
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
        {state.phase === "round-over" && state.lastMessage ? (
          <div
            className={`sk-panel sk-result-panel sk-result-panel--${state.outcome ?? "push"} px-5 py-3 text-center max-w-[80%]`}
            style={{ animationDelay: `${resultDelayMs}ms` }}
          >
            <div className="sk-title text-lg leading-tight" style={{ color: outcomeColor }}>
              {state.outcome === "win" ? "You win" : state.outcome === "lose" ? "Dealer wins" : "Push"}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--sk-ink-soft)" }}>
              {state.lastMessage}
            </div>
          </div>
        ) : hasHand ? (
          <div className="sk-panel px-4 py-1.5">
            <span className="sk-eyebrow text-xs">Wager: {state.wager} NIM</span>
          </div>
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">Place your bet</div>
        )}
      </div>

      <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2">
        {hasHand ? (
          <Hand
            cards={state.playerHand}
            label={playerLabel}
            active={state.phase === "player-turn"}
            turnNote={state.phase === "player-turn" ? "Your turn" : undefined}
          />
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">{playerLabel}</div>
        )}
      </div>
    </div>
  );
}
