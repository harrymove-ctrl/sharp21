import { useCallback, useState } from "react";
import * as engine from "../game/engine";
import { getConnectedAccount, isNetworkReady, isNimiqPayHost, payEntryFee, TREASURY_ADDRESS } from "../nimiq/client";

export type PaymentStatus = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string };

export function useBlackjack(options: { demoOnly?: boolean } = {}) {
  const { demoOnly = false } = options;
  const [state, setState] = useState(engine.initialState);
  const [payment, setPayment] = useState<PaymentStatus>({ kind: "idle" });
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // demoOnly forces the synchronous, no-wallet path regardless of host
  // context - BotVsBot's auto-play loop must never attempt a real payment,
  // even when genuinely running inside Nimiq Pay.
  const realMoney = !demoOnly && isNimiqPayHost();

  const connectWallet = useCallback(async () => {
    if (!realMoney || connecting) return;
    setConnecting(true);
    const acc = await getConnectedAccount();
    setAccount(acc);
    setConnecting(false);
  }, [realMoney, connecting]);

  const bet = useCallback(
    async (amount: number) => {
      if (!realMoney) {
        setState((s) => engine.placeBet(s, amount));
        return;
      }
      setPayment({ kind: "pending" });
      if (!(await isNetworkReady())) {
        setPayment({ kind: "error", message: "Nimiq network isn't ready yet - try again in a moment." });
        return;
      }
      const result = await payEntryFee(amount, TREASURY_ADDRESS);
      if (result.ok) {
        setPayment({ kind: "idle" });
        setState((s) => engine.placeBet(s, amount));
      } else {
        setPayment({ kind: "error", message: result.message });
      }
    },
    [realMoney],
  );
  const hit = useCallback(() => {
    setState((s) => engine.hit(s));
  }, []);
  const stand = useCallback(() => {
    setState((s) => engine.stand(s));
  }, []);
  const deal = useCallback(() => {
    setState((s) => engine.nextHand(s));
  }, []);
  const dismissPaymentError = useCallback(() => setPayment({ kind: "idle" }), []);

  return {
    state,
    bet,
    hit,
    stand,
    deal,
    payment,
    dismissPaymentError,
    realMoney,
    account,
    connecting,
    connectWallet,
  };
}
