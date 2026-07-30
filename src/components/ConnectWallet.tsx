import { useState } from "react";

/**
 * The Nimiq Hub path: connect a real wallet directly in this browser tab -
 * no phone, no Nimiq Pay app. Once connected, the parent flips into the
 * normal bet-with-chips flow, routing each payment through Hub's checkout
 * popup instead of the mini-app SDK.
 */
export function ConnectWallet({ onConnect }: { onConnect: () => Promise<string | null> }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    const address = await onConnect();
    setConnecting(false);
    if (!address) setError("Couldn't connect — try again.");
  };

  return (
    <div className="sk-panel px-4 py-3 flex flex-col items-center gap-2 max-w-xs text-center">
      <p className="sk-body text-xs leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
        Connect a Nimiq Hub wallet to play directly in this browser — no phone, no app needed. New
        to Nimiq? Hub lets you create a wallet on the spot.
      </p>
      <button type="button" className="sk-btn sk-btn--primary text-sm" onClick={handleConnect} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && (
        <p className="text-xs" style={{ color: "var(--sk-red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
