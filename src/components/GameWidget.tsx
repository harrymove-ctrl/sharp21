import type { useBlackjack } from "../hooks/useBlackjack";
import { Table } from "./Table";
import { Hud } from "./Hud";
import { BotVsBot } from "./BotVsBot";
import { OpenNimiqPay } from "./OpenNimiqPay";

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
              />
            </div>
          </>
        ) : (
          // No local demo here on purpose - Nimiq mini-apps only connect a
          // wallet from inside Nimiq Pay itself (unlike a regular web dApp,
          // there's no browser-based connect flow to fall back to), so
          // playing for real is gated behind actually getting there.
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <div className="sk-panel px-6 py-8 flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="sk-title text-lg">Connect your wallet to play</div>
              <p className="sk-body text-sm" style={{ color: "var(--sk-ink-soft)" }}>
                Sharp21 is a Nimiq Pay mini-app. Open it there to connect your wallet and play.
              </p>
              <OpenNimiqPay />
            </div>
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
            : "Connected to Nimiq Pay — entry fees are real NIM."}
        </p>
      )}
    </div>
  );
}
