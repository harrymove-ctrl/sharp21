import type { useBlackjack } from "../hooks/useBlackjack";
import { GameWidget, type Mode } from "./GameWidget";

/** The compact, single-viewport experience — what actually loads inside the Nimiq Pay WebView. */
export function MiniApp({
  mode,
  setMode,
  pve,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  pve: ReturnType<typeof useBlackjack>;
}) {
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col items-center px-3 py-2 gap-1.5">
      <div className="text-center shrink-0">
        <div className="sk-eyebrow text-[0.7rem]">Skill-based Blackjack</div>
        <div className="sk-title text-white text-3xl">Sharp21</div>
      </div>
      <GameWidget mode={mode} setMode={setMode} pve={pve} />
    </div>
  );
}
