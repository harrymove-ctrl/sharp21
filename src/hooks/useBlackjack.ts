import { useCallback, useEffect, useRef, useState } from "react";
import * as engine from "../game/engine";
import { getConnectedAccount, getDeviceId, isNetworkReady, isNimiqPayHost, payEntryFee, TREASURY_ADDRESS } from "../nimiq/client";
import { recordHand } from "../nimiq/backend";

export type PaymentStatus = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string };

interface PendingHandMeta {
  wagerLuna: number;
  entryFeeTxHash: string;
}

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

  // Per-hand bookkeeping needed to report the finished hand to the backend -
  // not part of the pure game state, so it lives alongside it here instead
  // of inside engine.GameState.
  const deviceIdRef = useRef<string | null>(null);
  const pendingHandRef = useRef<PendingHandMeta | null>(null);
  const lastReportedHandsPlayed = useRef(0);

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
      if (!result.ok) {
        setPayment({ kind: "error", message: result.message });
        return;
      }
      // Fetched lazily and cached for the session - the entry-fee payment
      // already prompted the wallet once, so this piggybacks on the same
      // "the user is actively engaging with their wallet" moment rather
      // than surprising them with a second unrelated prompt on hand #1 and
      // never again after that.
      if (!deviceIdRef.current) {
        deviceIdRef.current = await getDeviceId().catch(() => null);
      }
      if (!account) {
        const acc = await getConnectedAccount();
        if (acc) setAccount(acc);
      }
      pendingHandRef.current = { wagerLuna: Math.round(amount * 100_000), entryFeeTxHash: result.txHash };
      setPayment({ kind: "idle" });
      setState((s) => engine.placeBet(s, amount));
    },
    [realMoney, account],
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

  // Fires exactly once per newly-settled real-money hand, reporting the
  // decision grade (and only that - not the cosmetic win/lose) to the
  // backend leaderboard.
  useEffect(() => {
    if (!realMoney) return;
    if (state.handsPlayed <= lastReportedHandsPlayed.current) return;
    lastReportedHandsPlayed.current = state.handsPlayed;
    const meta = pendingHandRef.current;
    pendingHandRef.current = null;
    if (!meta || !deviceIdRef.current || !account) return;
    const correctThisHand = state.handDecisions.filter((d) => d.wasCorrect).length;
    void recordHand({
      deviceId: deviceIdRef.current,
      correctDecisions: correctThisHand,
      totalDecisions: state.handDecisions.length,
      wagerLuna: meta.wagerLuna,
      entryFeeTxHash: meta.entryFeeTxHash,
      payoutAddress: account,
    });
  }, [state.handsPlayed, realMoney, account, state.handDecisions]);

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
