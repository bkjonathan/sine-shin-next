/**
 * In-memory failed-attempt limiter, used to throttle sign-in (AUDIT.md F-07).
 *
 * `maxFailures` failures for a key inside a fixed `windowMs` (starting at the
 * first failure) block that key for `blockMs`. Attempts made while blocked are
 * not counted, so a block is never extended. State lives in this server process
 * only: it resets on restart and isn't shared between replicas, which suits the
 * single container this app runs as. At most `maxKeys` keys are held; when full,
 * keys that aren't blocked are evicted first (oldest first), so flooding new
 * keys can't lift an active block.
 */

type Entry = { failures: number; windowStart: number; blockedUntil: number };

export function createAttemptLimiter({
  maxFailures,
  windowMs,
  blockMs,
  maxKeys = 10_000,
  now = Date.now,
}: {
  maxFailures: number;
  windowMs: number;
  blockMs: number;
  maxKeys?: number;
  now?: () => number;
}) {
  const entries = new Map<string, Entry>();

  function makeRoom(t: number) {
    for (const [key, e] of entries) {
      if (entries.size < maxKeys) return;
      if (e.blockedUntil <= t) entries.delete(key);
    }
    // Everything left is blocked: drop the oldest to stay bounded.
    for (const key of entries.keys()) {
      if (entries.size < maxKeys) return;
      entries.delete(key);
    }
  }

  return {
    isBlocked(key: string): boolean {
      const e = entries.get(key);
      return !!e && e.blockedUntil > now();
    },

    recordFailure(key: string): void {
      const t = now();
      let e = entries.get(key);
      if (e && e.blockedUntil > t) return;
      // Start a fresh window on the first failure, after the window lapses, or
      // once a previous block has ended.
      if (!e || e.blockedUntil > 0 || t - e.windowStart >= windowMs) {
        if (!e) makeRoom(t);
        e = { failures: 0, windowStart: t, blockedUntil: 0 };
        entries.set(key, e);
      }
      e.failures += 1;
      if (e.failures >= maxFailures) e.blockedUntil = t + blockMs;
    },

    reset(key: string): void {
      entries.delete(key);
    },

    get size(): number {
      return entries.size;
    },
  };
}
