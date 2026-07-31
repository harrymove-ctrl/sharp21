import { useState } from "react";
import { requestTestnetNim } from "../nimiq/faucet";

type FaucetState = "idle" | "requesting" | "funded" | "error";

/**
 * Shown next to a connected real-money address so a low-balance testnet
 * account (the common case for a freshly-created Nimiq Hub wallet, or any
 * scan-to-pay/Hub address that's never been funded) has a one-tap way to
 * get free testnet NIM, instead of needing to find and use the faucet
 * separately. Testnet only - has zero real value.
 */
export function FaucetButton({ address }: { address: string }) {
  const [state, setState] = useState<FaucetState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setState("requesting");
    setError(null);
    const result = await requestTestnetNim(address);
    if (result.ok) {
      setState("funded");
    } else {
      setState("error");
      setError(result.message);
    }
  };

  if (state === "funded") {
    return (
      <span className="sk-body text-[0.65rem]" style={{ color: "var(--sk-good)" }}>
        Testnet NIM sent — may take a moment to arrive.
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        className="sk-body text-[0.65rem] underline"
        style={{ color: "rgba(255,255,255,0.6)" }}
        onClick={handleClick}
        disabled={state === "requesting"}
      >
        {state === "requesting" ? "Requesting…" : "Get testnet NIM"}
      </button>
      {state === "error" && (
        <span className="sk-body text-[0.6rem]" style={{ color: "var(--sk-red)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
