import type { useBlackjack } from "../hooks/useBlackjack";
import { GameWidget, type Mode } from "./GameWidget";

const REPO_URL = "https://github.com/harrymove-ctrl/sharp21";
const COMPETITION_URL = "https://miniappscompetition.com";

/** The full public web page — a proper site that also lets you play, not just the compact embed. */
export function WebLanding({
  mode,
  setMode,
  pve,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  pve: ReturnType<typeof useBlackjack>;
}) {
  return (
    <div className="min-h-screen w-full">
      <Header />
      <Hero />
      <section
        id="play"
        className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-start"
      >
        <div
          className="sk-panel p-8 flex items-center justify-center w-full"
          style={{ height: "min(880px, 85vh)" }}
        >
          <GameWidget mode={mode} setMode={setMode} pve={pve} />
        </div>
        <Sidebar />
      </section>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
      <div className="sk-title text-white text-xl">Sharp21</div>
      <nav className="flex gap-5 sk-body text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
        <a href="#play" className="sk-link">
          Play
        </a>
        <a href="#how-it-works" className="sk-link">
          How it works
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="sk-link">
          GitHub
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-3xl mx-auto text-center px-6 pt-10 pb-14">
      <div className="sk-eyebrow text-sm">Nimiq Mini Apps Competition</div>
      <h1 className="sk-title text-white text-5xl md:text-6xl mt-3">Sharp21</h1>
      <p className="sk-body text-lg mt-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
        Blackjack that pays you for playing well — not for getting lucky. Every hit or stand is
        graded against basic strategy; your NIM payout tracks decision accuracy, never a hand's
        chance outcome.
      </p>
      <div className="flex gap-3 justify-center mt-7">
        <a href="#play" className="sk-btn sk-btn--primary">
          Play now
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="sk-btn">
          View on GitHub
        </a>
      </div>
    </section>
  );
}

function Sidebar() {
  return (
    <aside id="how-it-works" className="flex flex-col gap-4">
      <div className="sk-panel p-5">
        <div className="sk-eyebrow text-sm mb-2">How payouts work</div>
        <ol
          className="sk-body text-sm list-decimal list-inside space-y-1.5"
          style={{ color: "var(--sk-ink-soft)" }}
        >
          <li>Pay a small NIM entry fee to play a hand.</li>
          <li>Play it out — hit or stand like real Blackjack.</li>
          <li>Every decision is graded against basic strategy.</li>
          <li>Ranked by total correct decisions, not wins.</li>
          <li>Top 10 split the pool in NIM when the window closes.</li>
        </ol>
      </div>
      <div className="sk-panel p-5">
        <div className="sk-eyebrow text-sm mb-2">Why not gambling?</div>
        <p className="sk-body text-sm leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
          No side is ever paid because another side lost a hand. Everyone is scored independently
          against one published, deterministic rule — the shape the competition's rules require
          for "skill-based games," as distinct from games of chance.
        </p>
      </div>
      <div className="sk-panel p-5">
        <div className="sk-eyebrow text-sm mb-2">Quick strategy reference</div>
        <p className="sk-body text-sm leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
          Hard 12–16 vs. dealer 2–6: stand. Vs. dealer 7–Ace: hit. Anything 11 or under: always
          hit. Live feedback after every decision shows you the right call either way.
        </p>
      </div>
    </aside>
  );
}

function Footer() {
  return (
    <footer
      className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap gap-3 justify-between sk-body text-xs"
      style={{ color: "rgba(255,255,255,0.4)" }}
    >
      <span>MIT Licensed</span>
      <a href={COMPETITION_URL} target="_blank" rel="noreferrer" className="sk-link text-xs">
        Nimiq Mini Apps Competition
      </a>
      <a href={REPO_URL} target="_blank" rel="noreferrer" className="sk-link text-xs">
        GitHub
      </a>
    </footer>
  );
}
