"use client";

import { useRef } from "react";
import { isAxiosError } from "axios";
import { nanoid } from "nanoid";

/**
 * True when a request failed without the app answering (no reply at all, or the
 * proxy gave up waiting), so the server may still have saved it.
 */
export function outcomeUnknown(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 502 || status === 503 || status === 504;
}

/**
 * One Idempotency-Key per submission, for a create hook (AUDIT.md F-13). After a
 * timeout the same key is sent again, so the server returns the record it already
 * saved instead of saving a second one. Once the app has answered (saved, refused
 * or failed) the next submission gets a new key.
 */
export function useIdempotencyKey() {
  const key = useRef<string | null>(null);
  return {
    headers: () => ({ "Idempotency-Key": (key.current ??= nanoid()) }),
    settle: (error: unknown) => {
      if (!outcomeUnknown(error)) key.current = null;
    },
  };
}
