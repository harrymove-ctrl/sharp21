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
    const platform = detectPlatform();
    // Nimiq Pay only exists as a mobile app - on desktop there's no app to
    // open and no store link to fall back to, so a "Try again" button would
    // just be lying (it can never succeed here, unlike a mobile browser
    // where the app might genuinely still be installing).
    if (platform === "unknown") {
      return (
        <div className="sk-panel px-4 py-3 text-center max-w-xs">
          <p className="sk-body text-xs leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
            Nimiq Pay is a mobile app. Open this page on your phone to connect your wallet and
            play.
          </p>
        </div>
      );
    }
    return (
      <a href={STORE_LINKS[platform]} className="sk-btn sk-btn--primary text-sm">
        Get Nimiq Pay
      </a>
    );
  }

  return (
    <button type="button" className="sk-btn sk-btn--primary text-sm" onClick={attemptOpen}>
      {state === "waiting" ? "Opening Nimiq Pay…" : "Open in Nimiq Pay"}
    </button>
  );
}
