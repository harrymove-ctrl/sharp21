import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardEntry } from "../nimiq/backend";

function truncate(deviceId: string): string {
  return `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sk-panel p-5">
      <div className="sk-eyebrow text-sm mb-2">Leaderboard</div>
      {error && (
        <p className="sk-body text-sm" style={{ color: "var(--sk-ink-soft)" }}>
          Couldn't load the leaderboard right now.
        </p>
      )}
      {!error && entries === null && (
        <p className="sk-body text-sm" style={{ color: "var(--sk-ink-soft)" }}>
          Loading…
        </p>
      )}
      {entries?.length === 0 && (
        <p className="sk-body text-sm" style={{ color: "var(--sk-ink-soft)" }}>
          No one's eligible yet — ranked by total correct decisions, once you've played enough hands.
        </p>
      )}
      {entries && entries.length > 0 && (
        <ol className="sk-body text-sm space-y-1">
          {entries.map((e) => (
            <li key={e.deviceId} className="flex justify-between gap-2">
              <span>
                #{e.rank} {truncate(e.deviceId)}
              </span>
              <span style={{ color: "var(--sk-ink-soft)" }}>{e.correctDecisions} correct</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
