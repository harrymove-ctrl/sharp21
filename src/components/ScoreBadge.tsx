import type { DecisionRecord } from "../game/engine";

export function ScoreBadge({
  correct,
  total,
  hands,
  lastDecision,
  decisionSeq,
}: {
  correct: number;
  total: number;
  hands: number;
  lastDecision?: DecisionRecord;
  /** Remount key for the decision line - state.handDecisions.length, so the
   *  fade-in replays for every graded decision within a hand, not just the
   *  first one (totalDecisions itself only updates once, at hand's end). */
  decisionSeq?: number;
}) {
  return (
    <div className="sk-panel px-4 py-2 text-center">
      <div className="sk-eyebrow text-[0.65rem]">Skill Score</div>
      <div key={`score-${correct}`} className="sk-title text-2xl leading-none sk-score-pop">
        {correct}
      </div>
      <div className="text-xs" style={{ color: "var(--sk-ink-soft)" }}>
        correct decisions · {hands} hand{hands === 1 ? "" : "s"} · {total} graded
      </div>
      {lastDecision && (
        <div
          key={`decision-${decisionSeq}`}
          className="text-xs mt-1 sk-decision-pill"
          style={{ color: lastDecision.wasCorrect ? "var(--sk-good)" : "var(--sk-red)" }}
        >
          {lastDecision.wasCorrect
            ? `✓ ${lastDecision.action} was optimal`
            : `✗ basic strategy says ${lastDecision.optimal}`}
        </div>
      )}
    </div>
  );
}
