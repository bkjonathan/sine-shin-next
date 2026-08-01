"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/**
 * Global top navigation progress bar.
 *
 * On iOS standalone PWAs there is no browser chrome, so a tap that triggers a
 * route change gives no feedback until the new screen renders — the app feels
 * frozen. This bar appears the instant a same-origin link is tapped and
 * completes when the route commits (pathname change), so navigation always
 * feels responsive. It pairs with the per-route `loading.tsx` skeletons, which
 * fill the content area once the transition lands.
 */
const SHOW_DELAY = 120; // ms — skip the bar entirely for instant transitions
const DONE_DELAY = 260; // ms — hold at 100% before fading out
const SAFETY_TIMEOUT = 10_000; // ms — auto-finish if the route never commits

export function NavProgress() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const running = useRef(false);
  const shown = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);

  // `finish` is created in the setup effect but must be callable from the
  // pathname effect; a ref bridges the two.
  const finishRef = useRef<() => void>(() => {});

  // Gate the portal until after mount so SSR renders nothing and there is no
  // hydration mismatch against document.body.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const clearRunTimers = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      if (trickle.current) clearInterval(trickle.current);
      showTimer.current = safetyTimer.current = null;
      trickle.current = null;
    };

    const finish = () => {
      if (!running.current) return;
      running.current = false;
      clearRunTimers();
      if (!shown.current) return; // bar never appeared — nothing to hide
      setProgress(100);
      doneTimer.current = setTimeout(() => {
        setVisible(false);
        shown.current = false;
        resetTimer.current = setTimeout(() => setProgress(0), 250);
      }, DONE_DELAY);
    };
    finishRef.current = finish;

    const start = () => {
      if (running.current) return;
      running.current = true;
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setProgress(0);
      // Delay showing so prefetched / instant navigations don't flash a bar.
      showTimer.current = setTimeout(() => {
        shown.current = true;
        setVisible(true);
        setProgress(12);
        trickle.current = setInterval(() => {
          // Ease toward 90% and stall there until the route commits.
          setProgress((p) =>
            p >= 90 ? p : Math.min(90, p + Math.max(0.6, (90 - p) * 0.08))
          );
        }, 220);
      }, SHOW_DELAY);
      safetyTimer.current = setTimeout(finish, SAFETY_TIMEOUT);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same URL → no navigation happens, so don't start a bar that never ends.
      if (
        url.pathname + url.search ===
        window.location.pathname + window.location.search
      ) {
        return;
      }
      start();
    };

    // Manual trigger for programmatic navigation (e.g. router.push after a
    // mutation): `window.__navProgressStart?.()`.
    const w = window as Window & { __navProgressStart?: () => void };
    w.__navProgressStart = start;

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearRunTimers();
      if (doneTimer.current) clearTimeout(doneTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      delete w.__navProgressStart;
    };
  }, []);

  // Complete the bar when the route commits. On the initial mount `running` is
  // false, so this no-ops.
  useEffect(() => {
    finishRef.current();
  }, [pathname]);

  if (!mounted) return null;

  return createPortal(
    <div className="nav-progress" style={{ opacity: visible ? 1 : 0 }} aria-hidden>
      <div className="nav-progress__bar" style={{ width: `${progress}%` }}>
        <div className="nav-progress__glow" />
      </div>
    </div>,
    document.body
  );
}
