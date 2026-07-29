import type { DecisionRecord } from "../game/engine";

export function ScoreBadge({
  correct,
  total,
  hands,
  lastDecision,
}: {
  correct: number;
  total: number;
  hands: number;
  lastDecision?: DecisionRecord;
}) {
  return (
    <div className="sk-panel px-4 py-2 text-center">
      <div className="sk-eyebrow text-[0.65rem]">Skill Score</div>
      <div className="sk-title text-2xl leading-none">{correct}</div>
      <div className="text-xs" style={{ color: "var(--sk-ink-soft)" }}>
        correct decisions · {hands} hand{hands === 1 ? "" : "s"} · {total} graded
      </div>
      {lastDecision && (
        <div
          className="text-xs mt-1 sk-fade-in-up"
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
