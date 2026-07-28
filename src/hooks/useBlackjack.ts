import { useCallback, useState } from "react";
import * as engine from "../game/engine";

export function useBlackjack() {
  const [state, setState] = useState(engine.initialState);

  const bet = useCallback((amount: number) => {
    setState((s) => engine.placeBet(s, amount));
  }, []);
  const hit = useCallback(() => {
    setState((s) => engine.hit(s));
  }, []);
  const stand = useCallback(() => {
    setState((s) => engine.stand(s));
  }, []);
  const deal = useCallback(() => {
    setState((s) => engine.nextHand(s));
  }, []);

  return { state, bet, hit, stand, deal };
}
