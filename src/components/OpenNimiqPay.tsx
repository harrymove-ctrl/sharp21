import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { detectPlatform, inAppBrowserName, openerLinks, STORE_LINKS } from "../nimiq/client";

type OpenState = "idle" | "waiting" | "not-installed";

/**
 * Shown when the mini-app is loaded outside Nimiq Pay (e.g. a link shared
 * to a plain browser). On desktop there is categorically no app that a
 * deep-link attempt could open - clicking one first and waiting to find
 * that out (like the mobile path below does) would just be theater, so
 * desktop goes straight to a QR of the deep link instead: scan it with any
 * phone camera to open Sharp21 inside Nimiq Pay there. Mobile still gets
 * the real thing - try the custom-scheme deep link, then fall back to the
 * app/play store if the tab is still visible after a beat (the OS never
 * actually backgrounded this page, so Nimiq Pay isn't installed). Skipped
 * entirely inside a social app's built-in browser, which blocks scheme
 * redirects outright regardless of what we try here.
 */
export function OpenNimiqPay() {
  const [state, setState] = useState<OpenState>("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const inAppBrowser = inAppBrowserName();
  const platform = detectPlatform();

  useEffect(() => {
    if (platform !== "unknown" || inAppBrowser) return;
    QRCode.toDataURL(openerLinks().scheme, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [platform, inAppBrowser]);

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

  if (platform === "unknown") {
    return (
      <div className="sk-panel px-4 py-3 flex flex-col items-center gap-2 max-w-xs">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Scan to open Sharp21 in Nimiq Pay" width={160} height={160} className="rounded-lg" />
        ) : (
          <div className="w-[160px] h-[160px] rounded-lg" style={{ background: "var(--sk-felt-fill)" }} />
        )}
        <p className="sk-body text-xs text-center leading-relaxed" style={{ color: "var(--sk-ink-soft)" }}>
          Nimiq Pay is a mobile app - scan with your phone to open Sharp21 there.
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
