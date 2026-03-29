"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  );
}

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed as standalone — never show
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Also covers iOS "navigator.standalone"
    if ((navigator as { standalone?: boolean }).standalone === true) return;

    // Dismissed before — respect the choice
    if (sessionStorage.getItem("pwa-banner-dismissed") === "1") return;

    const ios = detectIOS();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(ios);

    if (ios) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("pwa-banner-dismissed", "1");
    setShow(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-start gap-3 border-t border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-lg backdrop-blur-md md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[420px] md:rounded-2xl md:border"
    >
      {/* App icon */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192x192.png"
        alt=""
        width={48}
        height={48}
        className="shrink-0 rounded-xl"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-1)]">
          Install Shop Manager
        </p>

        {isIOS ? (
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            Tap the{" "}
            <Share
              className="inline h-3.5 w-3.5 align-[-2px]"
              aria-label="Share"
            />{" "}
            button then <strong>&ldquo;Add to Home Screen&rdquo;</strong> to
            install.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-[var(--text-2)]">
            Add to your home screen for a better experience.
          </p>
        )}

        {!isIOS && (
          <button
            onClick={install}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </button>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="shrink-0 rounded-lg p-1 text-[var(--text-3)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-1)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
