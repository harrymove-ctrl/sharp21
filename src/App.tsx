import { useState } from "react";
import { useBlackjack } from "./hooks/useBlackjack";
import { Table } from "./components/Table";
import { Hud } from "./components/Hud";
import { SketchDefs } from "./components/SketchDefs";
import { BotVsBot } from "./components/BotVsBot";

type Mode = "pve" | "bots";

export default function App() {
  const [mode, setMode] = useState<Mode>("pve");
  const { state, bet, hit, stand, deal } = useBlackjack();

  return (
    <div className="sk-root h-dvh w-full overflow-hidden flex flex-col items-center px-3 py-2 gap-1.5">
      <SketchDefs />
      <div className="text-center shrink-0">
        <div className="sk-eyebrow text-[0.7rem]">Skill-based Blackjack</div>
        <div className="sk-title text-white text-3xl">Sharp21</div>
      </div>

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

      {mode === "pve" ? (
        <>
          <div className="flex-1 min-h-0 w-full flex items-center justify-center">
            <Table state={state} />
          </div>
          <div className="shrink-0">
            <Hud state={state} onBet={bet} onHit={hit} onStand={stand} onDeal={deal} />
          </div>
        </>
      ) : (
        <BotVsBot />
      )}

      <p
        className="text-[0.65rem] leading-tight text-center max-w-sm shrink-0"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        Demo build — wallet payment not wired up yet. Only decision accuracy (above) will
        determine real payouts.
      </p>
    </div>
  );
}
