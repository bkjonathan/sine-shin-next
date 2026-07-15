"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

/**
 * iOS Safari on iPhone exposes no Fullscreen API outside of <video>, so there
 * `data-fullscreen` on <html> drives a CSS-only immersive mode instead.
 */
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
  };
}

function subscribeToNothing() {
  return () => {};
}

function isFullscreenSupported(): boolean {
  const root = document.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen);
}

export function useFullscreen() {
  // Native fullscreen can also be left via Esc or the browser's own UI, so the
  // document is the source of truth rather than a local flag.
  const nativeFullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    () => Boolean(getFullscreenElement()),
    () => false
  );
  const supported = useSyncExternalStore(
    subscribeToNothing,
    isFullscreenSupported,
    () => true
  );
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);

  const isFullscreen = nativeFullscreen || fallbackFullscreen;

  useEffect(() => {
    if (!fallbackFullscreen) return;
    document.documentElement.dataset.fullscreen = "true";
    return () => {
      delete document.documentElement.dataset.fullscreen;
    };
  }, [fallbackFullscreen]);

  const toggle = useCallback(async () => {
    if (!isFullscreenSupported()) {
      setFallbackFullscreen((prev) => !prev);
      return;
    }

    try {
      if (getFullscreenElement()) {
        const doc = document as FullscreenDocument;
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        const root = document.documentElement as FullscreenElement;
        await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
      }
    } catch {
      // Denied (permissions policy, or a gesture the browser rejected) — fall
      // back to immersive mode so the control still does something visible.
      setFallbackFullscreen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "F11") {
        event.preventDefault();
        void toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { isFullscreen, supported, toggle };
}
