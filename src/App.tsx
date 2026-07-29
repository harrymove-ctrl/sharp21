import { useState } from "react";
import { useBlackjack } from "./hooks/useBlackjack";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { SketchDefs } from "./components/SketchDefs";
import { MiniApp } from "./components/MiniApp";
import { WebLanding } from "./components/WebLanding";
import type { Mode } from "./components/GameWidget";

export default function App() {
  const isWide = useMediaQuery("(min-width: 768px)");
  const [mode, setMode] = useState<Mode>("pve");
  const pve = useBlackjack();

  return (
    <div className="sk-root">
      <SketchDefs />
      {isWide ? (
        <WebLanding mode={mode} setMode={setMode} pve={pve} />
      ) : (
        <MiniApp mode={mode} setMode={setMode} pve={pve} />
      )}
    </div>
  );
}
