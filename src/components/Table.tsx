import type { GameState } from "../game/engine";
import { Hand } from "./Hand";
import { ScoreBadge } from "./ScoreBadge";

export function Table({ state }: { state: GameState }) {
  const hasHand = state.playerHand.length > 0;
  return (
    <div className="sk-felt relative w-full aspect-[5/8] max-w-md mx-auto rounded-[28px] overflow-hidden">
      <div className="absolute top-[3%] left-1/2 -translate-x-1/2">
        <ScoreBadge correct={state.correctDecisions} total={state.totalDecisions} hands={state.handsPlayed} />
      </div>

      <div className="absolute top-[28%] left-1/2 -translate-x-1/2">
        {hasHand ? (
          <Hand cards={state.dealerHand} hideSecond={state.dealerHoleHidden} label="Dealer" />
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">Dealer</div>
        )}
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
        {state.phase === "round-over" && state.lastMessage ? (
          <div className="sk-panel sk-fade-in-up px-5 py-3 text-center max-w-[80%]">
            <div className="sk-title text-lg leading-tight">
              {state.outcome === "win" ? "You win" : state.outcome === "lose" ? "Dealer wins" : "Push"}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--sk-ink-soft)" }}>
              {state.lastMessage}
            </div>
          </div>
        ) : hasHand ? (
          <div className="sk-panel px-4 py-1.5">
            <span className="sk-eyebrow text-xs">Wager: {state.wager}</span>
          </div>
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">Place your bet</div>
        )}
      </div>

      <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2">
        {hasHand ? (
          <Hand cards={state.playerHand} label="You" />
        ) : (
          <div className="sk-eyebrow text-xs opacity-60">You</div>
        )}
      </div>
    </div>
  );
}
