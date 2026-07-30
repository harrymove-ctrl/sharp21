import { useCallback, useEffect, useRef, useState } from "react";
import * as engine from "../game/engine";
import {
  getConnectedAccount,
  getDeviceId,
  isNetworkReady,
  isNimiqPayHost,
  LUNA_PER_NIM,
  payEntryFee,
  TREASURY_ADDRESS,
} from "../nimiq/client";
import { connectHubWallet, payViaHub } from "../nimiq/hub";
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

  // Sticky for the rest of the session once set: outside Nimiq Pay, there's
  // no in-page wallet to connect to, so the "scan to pay" flow (see
  // ScanToPay.tsx) becomes the payment path for every hand from here on,
  // not just the one that unlocked it - see confirmScannedPayment below.
  const [scanPaySender, setScanPaySender] = useState<string | null>(null);
  const usingScanToPay = scanPaySender !== null;

  // Same "sticky once set" reasoning as scanPaySender: once connected via
  // Hub, every bet routes through Hub's checkout popup, not just the one
  // that unlocked it.
  const [hubAccount, setHubAccount] = useState<string | null>(null);
  const usingHub = hubAccount !== null;

  // demoOnly forces the synchronous, no-wallet path regardless of host
  // context - BotVsBot's auto-play loop must never attempt a real payment,
  // even when genuinely running inside Nimiq Pay. Real money now has three
  // possible sources: the in-app Nimiq Pay wallet, a completed scan-to-pay
  // payment, or a connected Nimiq Hub wallet.
  const realMoney = !demoOnly && (isNimiqPayHost() || usingScanToPay || usingHub);

  // Per-hand bookkeeping needed to report the finished hand to the backend -
  // not part of the pure game state, so it lives alongside it here instead
  // of inside engine.GameState. Holds either a mini-app device identifier or
  // (for scan-to-pay players, who have no device identifier available) the
  // paying wallet's own address - either is a fine, stable leaderboard key.
  const identityRef = useRef<string | null>(null);
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

      // Hub payments go through their own checkout popup - no Nimiq Pay
      // network-consensus pre-flight applies here (that check is specific
      // to the mini-app SDK's bridge, and would just fail outside Nimiq Pay,
      // which is exactly where Hub is used), and the paying address is
      // already known from connectHub(), not fetched lazily like the
      // mini-app path's device id below.
      if (usingHub) {
        const hubResult = await payViaHub(amount, TREASURY_ADDRESS);
        if (!hubResult.ok) {
          setPayment({ kind: "error", message: hubResult.message });
          return;
        }
        pendingHandRef.current = { wagerLuna: Math.round(amount * 100_000), entryFeeTxHash: hubResult.txHash };
        setPayment({ kind: "idle" });
        setState((s) => engine.placeBet(s, amount));
        return;
      }

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
      if (!identityRef.current) {
        identityRef.current = await getDeviceId().catch(() => null);
      }
      if (!account) {
        const acc = await getConnectedAccount();
        if (acc) setAccount(acc);
      }
      pendingHandRef.current = { wagerLuna: Math.round(amount * 100_000), entryFeeTxHash: result.txHash };
      setPayment({ kind: "idle" });
      setState((s) => engine.placeBet(s, amount));
    },
    [realMoney, usingHub, account],
  );

  /** Opens the Hub popup to connect (or create) a wallet, then unlocks the normal chip-betting flow. */
  const connectHub = useCallback(async () => {
    const address = await connectHubWallet();
    if (address) {
      identityRef.current = address;
      setHubAccount(address);
      setAccount(address);
    }
    return address;
  }, []);

  // Counterpart to bet() for a payment completed via the ScanToPay QR flow
  // instead of the in-app SDK - the payment already happened on-chain
  // (verified server-side by nonce match) by the time this is called, so
  // this just wires the result into the same hand-tracking state bet()
  // would have set up, and marks the session as using scan-to-pay for every
  // hand from here on.
  const confirmScannedPayment = useCallback(
    (paid: { wagerLuna: number; txHash: string; senderAddress: string }) => {
      identityRef.current = paid.senderAddress;
      setScanPaySender(paid.senderAddress);
      setAccount(paid.senderAddress);
      pendingHandRef.current = { wagerLuna: paid.wagerLuna, entryFeeTxHash: paid.txHash };
      setState((s) => engine.placeBet(s, paid.wagerLuna / LUNA_PER_NIM));
    },
    [],
  );

  const hit = useCallback(() => {
    setState((s) => engine.hit(s));
  }, []);
  const stand = useCallback(() => {
    setState((s) => engine.stand(s));
  }, []);
  const double = useCallback(() => {
    setState((s) => engine.double(s));
  }, []);
  const surrender = useCallback(() => {
    setState((s) => engine.surrender(s));
  }, []);
  const takeInsurance = useCallback(() => {
    setState((s) => engine.takeInsurance(s));
  }, []);
  const declineInsurance = useCallback(() => {
    setState((s) => engine.declineInsurance(s));
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
    if (!meta || !identityRef.current || !account) return;
    const insuranceGraded = state.insuranceDecision !== null;
    const correctThisHand = state.handDecisions.filter((d) => d.wasCorrect).length + (state.insuranceDecision === "declined" ? 1 : 0);
    const totalDecisionsThisHand = state.handDecisions.length + (insuranceGraded ? 1 : 0);
    void recordHand({
      deviceId: identityRef.current,
      correctDecisions: correctThisHand,
      totalDecisions: totalDecisionsThisHand,
      wagerLuna: meta.wagerLuna,
      entryFeeTxHash: meta.entryFeeTxHash,
      payoutAddress: account,
    });
  }, [state.handsPlayed, realMoney, account, state.handDecisions, state.insuranceDecision]);

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
    usingScanToPay,
    confirmScannedPayment,
    usingHub,
    connectHub,
    onDouble: double,
    onSurrender: surrender,
    onTakeInsurance: takeInsurance,
    onDeclineInsurance: declineInsurance,
    canDoubleOrSurrender: engine.canDoubleOrSurrender(state),
  };
}
