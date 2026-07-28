export function ScoreBadge({ correct, total, hands }: { correct: number; total: number; hands: number }) {
  return (
    <div className="sk-panel px-4 py-2 text-center">
      <div className="sk-eyebrow text-[0.65rem]">Skill Score</div>
      <div className="sk-title text-2xl leading-none">{correct}</div>
      <div className="text-xs" style={{ color: "var(--sk-ink-soft)" }}>
        correct decisions · {hands} hand{hands === 1 ? "" : "s"} · {total} graded
      </div>
    </div>
  );
}
