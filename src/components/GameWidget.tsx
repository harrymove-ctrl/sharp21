import { useState } from "react";
import type { useBlackjack } from "../hooks/useBlackjack";
import { Table } from "./Table";
import { Hud } from "./Hud";
import { BotVsBot } from "./BotVsBot";
import { OpenNimiqPay } from "./OpenNimiqPay";
import { ScanToPay } from "./ScanToPay";
import { ConnectWallet } from "./ConnectWallet";

export type Mode = "pve" | "bots";

/**
 * The actual game experience: mode tabs, subtitle, table/HUD or bot spectate.
 * Shared verbatim between the compact mini-app view and the wider web
 * landing page so both surfaces stay in lockstep with the same game logic -
 * only the surrounding page chrome differs.
 */
export function GameWidget({
  mode,
  setMode,
  pve,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  pve: ReturnType<typeof useBlackjack>;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full h-full min-h-0">
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          className={`sk-btn text-sm ${mode === "pve" ? "sk-btn--primary" : ""}`}
          onClick={() => setMode("pve")}
        >
          Play (PvE)
        </button>
        <button
          type="button"
          className={`sk-btn text-sm ${mode === "bots" ? "sk-btn--primary" : ""}`}
          onClick={() => setMode("bots")}
        >
          Watch bots
        </button>
      </div>

      <div className="sk-eyebrow text-[0.6rem] opacity-80 text-center max-w-xs shrink-0">
        {mode === "pve"
          ? pve.realMoney
            ? "Hit or stand correctly, not just win — your NIM payout tracks decision accuracy, never a hand's outcome"
            : "Connect your wallet in Nimiq Pay to play for real NIM"
          : "Demo only: two bots auto-play basic strategy, nothing is at stake"}
      </div>

      {mode === "pve" ? (
        pve.realMoney ? (
          <>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              <Table state={pve.state} />
            </div>
            <div className="shrink-0">
              <Hud
                state={pve.state}
                payment={pve.payment}
                onBet={pve.bet}
                onHit={pve.hit}
                onStand={pve.stand}
                onDeal={pve.deal}
                onDismissPaymentError={pve.dismissPaymentError}
                usingScanToPay={pve.usingScanToPay}
                onScannedPaid={pve.confirmScannedPayment}
              />
            </div>
          </>
        ) : (
          // Nimiq mini-apps only connect a wallet from inside Nimiq Pay
          // itself, so playing from a plain browser goes through "scan to
          // pay" instead: Nimiq Pay's own QR scanner completes the payment
          // wallet-to-wallet, no mini-app load required on that side at all.
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <PlayGate onScannedPaid={pve.confirmScannedPayment} onConnectHub={pve.connectHub} />
          </div>
        )
      ) : (
        <BotVsBot />
      )}

      {mode === "pve" && pve.realMoney && (
        <div className="shrink-0">
          {pve.account ? (
            <span className="sk-body text-[0.65rem]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Connected: {pve.account.split(" ")[0]}…{pve.account.split(" ").slice(-1)[0]}
            </span>
          ) : (
            <button
              type="button"
              className="sk-body text-[0.65rem] underline"
              style={{ color: "rgba(255,255,255,0.6)" }}
              onClick={pve.connectWallet}
              disabled={pve.connecting}
            >
              {pve.connecting ? "Connecting…" : "Show connected wallet"}
            </button>
          )}
        </div>
      )}

      {mode === "pve" && !pve.realMoney ? null : (
        <p
          className="sk-body text-[0.65rem] leading-tight text-center max-w-sm shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          {mode === "bots"
            ? "Spectate mode — no wallet, no entry fee, purely illustrative."
            : mode === "pve" && pve.usingScanToPay
              ? "Paid via scan-to-pay — entry fees are real NIM."
              : mode === "pve" && pve.usingHub
                ? "Connected via Nimiq Hub — entry fees are real NIM."
                : "Connected to Nimiq Pay — entry fees are real NIM."}
        </p>
      )}
    </div>
  );
}

type GateTab = "scan" | "connect" | "open";

/**
 * Shown outside Nimiq Pay in place of the table/HUD: three independent
 * paths to a real hand, since none of them works for everyone -
 * "Open in Nimiq Pay" needs the app installed on THIS device, "Scan to pay"
 * needs a phone with Nimiq Pay nearby, "Connect Wallet" (Nimiq Hub) needs
 * neither but requires a Hub-compatible wallet/account.
 */
function PlayGate({
  onScannedPaid,
  onConnectHub,
}: {
  onScannedPaid: (payment: { wagerLuna: number; txHash: string; senderAddress: string }) => void;
  onConnectHub: () => Promise<string | null>;
}) {
  const [tab, setTab] = useState<GateTab>("scan");
  return (
    <div className="sk-panel px-6 py-8 flex flex-col items-center gap-4 text-center max-w-xs">
      <div>
        <div className="sk-title text-lg">Connect your wallet to play</div>
        <p className="sk-body text-sm mt-1" style={{ color: "var(--sk-ink-soft)" }}>
          Scan with your phone, connect a Nimiq Hub wallet right here, or open Sharp21 in Nimiq Pay
          directly.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          className={`sk-btn text-sm ${tab === "scan" ? "sk-btn--primary" : ""}`}
          onClick={() => setTab("scan")}
        >
          Scan to pay
        </button>
        <button
          type="button"
          className={`sk-btn text-sm ${tab === "connect" ? "sk-btn--primary" : ""}`}
          onClick={() => setTab("connect")}
        >
          Connect Wallet
        </button>
        <button
          type="button"
          className={`sk-btn text-sm ${tab === "open" ? "sk-btn--primary" : ""}`}
          onClick={() => setTab("open")}
        >
          Open in Nimiq Pay
        </button>
      </div>
      {tab === "scan" ? (
        <ScanToPay onPaid={onScannedPaid} />
      ) : tab === "connect" ? (
        <ConnectWallet onConnect={onConnectHub} />
      ) : (
        <OpenNimiqPay />
      )}
    </div>
  );
}
