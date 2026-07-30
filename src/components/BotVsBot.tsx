import { useEffect, useRef } from "react";
import { useBlackjack } from "../hooks/useBlackjack";
import { handValue } from "../game/cards";
import { optimalAction } from "../game/strategy";
import { Table } from "./Table";

const STEP_MS = 900;

/**
 * Pure spectate mode: both seats are bots (the "player" seat plays textbook
 * basic strategy). No entry fee, no Skill Score — this state is a separate
 * hook instance from the real game and never feeds the graded loop, since a
 * bot always playing optimally would trivially top a real leaderboard.
 */
export function BotVsBot() {
  const { state, bet, hit, stand, deal } = useBlackjack({ demoOnly: true });
  const latest = useRef({ state, bet, hit, stand, deal });
  latest.current = { state, bet, hit, stand, deal };

  useEffect(() => {
    const id = setTimeout(() => {
      const { state: s, bet, hit, stand, deal } = latest.current;
      if (s.phase === "betting") {
        bet(1);
      } else if (s.phase === "player-turn") {
        const hv = handValue(s.playerHand);
        const action = optimalAction(hv.total, hv.isSoft, s.dealerHand[0].rank, false, false);
        if (action === "hit") hit();
        else stand();
      } else if (s.phase === "round-over") {
        deal();
      }
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [state]);

  const correct = state.handDecisions.filter((d) => d.wasCorrect).length;
  const wrong = state.handDecisions.length - correct;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-2">
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        <Table state={state} showScore={false} playerLabel="Bot" />
      </div>
      <div className="sk-eyebrow text-[0.6rem] opacity-60">
        hands played: {state.handsPlayed} · bot strategy this hand: {correct} right / {wrong} wrong
      </div>
    </div>
  );
}
