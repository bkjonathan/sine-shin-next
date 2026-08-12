"use client";

import { useSyncExternalStore } from "react";

/** The browser origin never changes for the life of the document. */
const subscribe = () => () => {};
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => "";

/**
 * Origin to build public (carrier-facing) links from.
 *
 * Falls back to the browser origin, which is right for the usual setup where
 * staff and carriers reach the app on the same hostname. Set
 * `NEXT_PUBLIC_APP_URL` when staff use an internal host — a QR pointing at
 * `http://192.168.x.x:3000` is useless on a carrier's phone.
 *
 * Resolves to "" on the server so the markup matches on hydration; every
 * consumer only needs the value after mount (QR generation, opening a link).
 */
export function usePublicOrigin(): string {
  const browserOrigin = useSyncExternalStore(subscribe, getClientOrigin, getServerOrigin);
  return process.env.NEXT_PUBLIC_APP_URL || browserOrigin;
}
