import { useState } from "react";
import { detectPlatform, inAppBrowserName, openerLinks, STORE_LINKS } from "../nimiq/client";

type OpenState = "idle" | "waiting" | "not-installed";

/**
 * Shown when the mini-app is loaded outside Nimiq Pay (e.g. a link shared
 * to a plain browser). Turns "open this in Nimiq Pay" from a static
 * instruction into an actual path: try the custom-scheme deep link, then
 * fall back to the app/play store if the tab is still visible after a beat
 * - the OS never actually backgrounded this page, so Nimiq Pay isn't
 * installed. Skipped entirely inside a social app's built-in browser, which
 * blocks scheme redirects outright regardless of what we try here.
 */
export function OpenNimiqPay() {
  const [state, setState] = useState<OpenState>("idle");
  const inAppBrowser = inAppBrowserName();

  if (inAppBrowser) {
    return (
      <div className="sk-panel px-4 py-3 text-left max-w-xs">
        <div className="sk-eyebrow text-xs mb-1">Opened inside {inAppBrowser}</div>
        <p className="sk-body text-xs leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
          {inAppBrowser}'s built-in browser blocks apps like Nimiq Pay from opening directly. Tap
          the ••• or share icon above and choose "Open in browser", then come back to this link.
        </p>
      </div>
    );
  }

  const attemptOpen = () => {
    setState("waiting");
    window.location.href = openerLinks().scheme;
    setTimeout(() => {
      if (document.visibilityState === "visible") {
        setState("not-installed");
      }
    }, 1600);
  };

  if (state === "not-installed") {
    const storeUrl = STORE_LINKS[detectPlatform()];
    return storeUrl ? (
      <a href={storeUrl} className="sk-btn sk-btn--primary text-sm">
        Get Nimiq Pay
      </a>
    ) : (
      <button type="button" className="sk-btn text-sm" onClick={attemptOpen}>
        Try again
      </button>
    );
  }

  return (
    <button type="button" className="sk-btn sk-btn--primary text-sm" onClick={attemptOpen}>
      {state === "waiting" ? "Opening Nimiq Pay…" : "Open in Nimiq Pay"}
    </button>
  );
}
