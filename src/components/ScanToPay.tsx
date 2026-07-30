import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { BET_OPTIONS } from "../game/engine";
import { TREASURY_ADDRESS } from "../nimiq/client";
import { buildNimiqPaymentUri, composePayMessage, generatePayNonce } from "../nimiq/payRequest";
import { detectPayment } from "../nimiq/backend";
import { Chip } from "./Chip";

const POLL_INTERVAL_MS = 8000;
// The chain-explorer lookup backing this has been observed taking ~15s per
// call and its testnet coverage is unverified - stop polling after a while
// rather than leaving someone staring at a spinner that may never resolve.
const DETECTION_TIMEOUT_MS = 5 * 60_000;

type Status = "picking" | "waiting" | "timeout" | "error";

export function ScanToPay({
  onPaid,
}: {
  onPaid: (payment: { wagerLuna: number; txHash: string; senderAddress: string }) => void;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("picking");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const nonceRef = useRef<string | null>(null);
  const sinceRef = useRef(0);
  const firedRef = useRef(false);

  const startWatching = (chosenAmount: number) => {
    const nonce = generatePayNonce();
    nonceRef.current = nonce;
    sinceRef.current = Date.now();
    firedRef.current = false;
    setAmount(chosenAmount);
    setStatus("waiting");
    const uri = buildNimiqPaymentUri({
      address: TREASURY_ADDRESS,
      amountNIM: chosenAmount,
      message: composePayMessage(nonce),
    });
    QRCode.toDataURL(uri, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  };

  const reset = () => {
    setAmount(null);
    setStatus("picking");
    setQrDataUrl(null);
    setErrorMessage("");
    nonceRef.current = null;
  };

  useEffect(() => {
    if (status !== "waiting" || amount === null || !nonceRef.current) return;
    const nonce = nonceRef.current;
    const amountLuna = Math.round(amount * 100_000);
    const since = sinceRef.current;
    let cancelled = false;

    const poll = async () => {
      if (firedRef.current || cancelled) return;
      try {
        const result = await detectPayment({ nonce, amountLuna, sinceMs: since });
        if (cancelled || firedRef.current) return;
        if (result.found && result.txHash && result.senderAddress) {
          firedRef.current = true;
          onPaid({ wagerLuna: amountLuna, txHash: result.txHash, senderAddress: result.senderAddress });
        }
      } catch {
        // transient network/backend blip - keep polling, don't surface every miss as an error
      }
    };

    void poll();
    const interval = setInterval(() => {
      if (Date.now() - since > DETECTION_TIMEOUT_MS) {
        setStatus("timeout");
        return;
      }
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, amount]);

  if (status === "picking") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="sk-eyebrow text-[0.6rem] opacity-80">Pick an amount, then scan with Nimiq Pay</div>
        <div className="flex items-center justify-center gap-3">
          {BET_OPTIONS.map((amt) => (
            <Chip key={amt} value={amt} onClick={() => startWatching(amt)} />
          ))}
        </div>
      </div>
    );
  }

  if (status === "timeout" || status === "error") {
    return (
      <div className="sk-panel px-4 py-3 text-center max-w-xs flex flex-col items-center gap-2">
        <p className="sk-body text-xs leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
          {status === "timeout"
            ? "Didn't see that payment come through in time."
            : errorMessage || "Something went wrong."}
        </p>
        <button type="button" className="sk-btn text-sm" onClick={reset}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="sk-panel px-4 py-3 flex flex-col items-center gap-2 max-w-xs">
      {qrDataUrl ? (
        <img src={qrDataUrl} alt={`Scan to pay ${amount} NIM`} width={180} height={180} className="rounded-lg" />
      ) : (
        <div className="w-[180px] h-[180px] rounded-lg" style={{ background: "var(--sk-felt-fill)" }} />
      )}
      <p className="sk-body text-xs text-center leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
        Open Nimiq Pay → tap the scanner → scan this code to pay {amount} NIM.
      </p>
      <div className="flex items-center gap-2 sk-eyebrow text-[0.6rem]">
        <span className="sk-turn-dot" aria-hidden="true" />
        Waiting for payment…
      </div>
      <button
        type="button"
        className="sk-body text-[0.65rem] underline"
        style={{ color: "var(--sk-ink-soft)" }}
        onClick={reset}
      >
        Choose a different amount
      </button>
    </div>
  );
}
