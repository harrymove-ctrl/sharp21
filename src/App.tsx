import { useBlackjack } from "./hooks/useBlackjack";
import { Table } from "./components/Table";
import { Hud } from "./components/Hud";
import { SketchDefs } from "./components/SketchDefs";

export default function App() {
  const { state, bet, hit, stand, deal } = useBlackjack();

  return (
    <div className="sk-root min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-8">
      <SketchDefs />
      <div className="text-center">
        <div className="sk-eyebrow">Skill-based Blackjack</div>
        <div className="sk-title text-white">Sharp21</div>
      </div>
      <Table state={state} />
      <Hud state={state} onBet={bet} onHit={hit} onStand={stand} onDeal={deal} />
      <p className="text-xs text-center max-w-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
        Demo build — entry-fee payment and NIM payout are not wired up yet. Only decision
        accuracy (shown above) will determine real payouts once wallet integration lands.
      </p>
    </div>
  );
}
