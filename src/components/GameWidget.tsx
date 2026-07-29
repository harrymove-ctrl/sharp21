import type { useBlackjack } from "../hooks/useBlackjack";
import { Table } from "./Table";
import { Hud } from "./Hud";
import { BotVsBot } from "./BotVsBot";

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
          ? "Hit or stand correctly, not just win — your NIM payout tracks decision accuracy, never a hand's outcome"
          : "Demo only: two bots auto-play basic strategy, nothing is at stake"}
      </div>

      {mode === "pve" ? (
        <>
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <Table state={pve.state} />
          </div>
          <div className="shrink-0">
            <Hud state={pve.state} onBet={pve.bet} onHit={pve.hit} onStand={pve.stand} onDeal={pve.deal} />
          </div>
        </>
      ) : (
        <BotVsBot />
      )}

      <p
        className="sk-body text-[0.65rem] leading-tight text-center max-w-sm shrink-0"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        Demo build — wallet payment not wired up yet. Only decision accuracy (above) will
        determine real payouts.
      </p>
    </div>
  );
}
