import { createHash } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { withAudit, type Tx } from "@/lib/audit";

// The browser sends a nanoid per submission (src/hooks/use-idempotency-key.ts).
const KEY_FORMAT = /^[A-Za-z0-9_-]{16,100}$/;

type Outcome = { saved: { data: unknown } } | { earlier: typeof idempotencyKeys.$inferSelect };

/** Thrown to roll back a refused create, key claim included, and send its reply. */
class Refused extends Error {
  response: Response;
  constructor(response: Response) {
    super("create refused");
    this.response = response;
  }
}

/**
 * Runs a create route's work in one transaction and replies 201 { data }, at
 * most once per Idempotency-Key (AUDIT.md F-13).
 *
 * When the request has a key, the key is claimed in the same transaction before
 * `create` runs:
 * - A retry with that key waits for the first attempt to finish. If it saved,
 *   the retry gets the same reply (with Idempotent-Replayed: true) and nothing
 *   new is created; if it rolled back, the retry creates normally.
 * - The same key with different values, or on another endpoint, gets 422.
 * Keys are per user, so one user's key never returns another user's record.
 * Without a key the create simply runs, as before.
 *
 * `input` is the validated body; its hash tells a retry from a different
 * submission. `create` may return a Response (a 400, say) to refuse: the
 * transaction rolls back, so the key isn't used up.
 */
export async function createOnce(
  req: Request,
  session: Session,
  input: unknown,
  create: (tx: Tx) => Promise<unknown>,
): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  const userId = session.user?.id;
  if (key !== null && !KEY_FORMAT.test(key)) {
    return NextResponse.json({ error: "Idempotency-Key must be 16–100 letters, digits, - or _" }, { status: 400 });
  }
  if (key !== null && !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = `${req.method} ${new URL(req.url).pathname}`;
  const fingerprint = createHash("sha256").update(JSON.stringify(input) ?? "").digest("hex");

  const run = async (tx: Tx) => {
    const result = await create(tx);
    if (result instanceof Response) throw new Refused(result);
    return { data: result };
  };

  let outcome: Outcome;
  try {
    outcome = await withAudit(req, session, async (tx): Promise<Outcome> => {
      if (key === null || !userId) return { saved: await run(tx) };
      const mine = and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key));
      // Waits here while another attempt with this key is still running.
      const [claimed] = await tx
        .insert(idempotencyKeys)
        .values({ userId, key, request, fingerprint })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key });
      if (!claimed) {
        const [earlier] = await tx.select().from(idempotencyKeys).where(mine);
        if (!earlier) throw new Error("Idempotency key was taken but can't be read");
        return { earlier };
      }
      const saved = await run(tx);
      await tx.update(idempotencyKeys).set({ response: saved }).where(mine);
      return { saved };
    });
  } catch (err) {
    if (err instanceof Refused) return err.response;
    throw err;
  }

  if ("earlier" in outcome) {
    const { earlier } = outcome;
    if (earlier.request !== request || earlier.fingerprint !== fingerprint) {
      return NextResponse.json(
        { error: "This form was already saved with different values. Reload the page to see what was saved before submitting again." },
        { status: 422 }
      );
    }
    return NextResponse.json(earlier.response, { status: 201, headers: { "Idempotent-Replayed": "true" } });
  }
  if (key !== null) await forgetOldKeys();
  return NextResponse.json(outcome.saved, { status: 201 });
}

/** Keys only need to outlive a retry. Runs after the create commits, so it never holds one up. */
async function forgetOldKeys() {
  try {
    await db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, sql`now() - interval '24 hours'`));
  } catch (err) {
    console.error("[idempotency] removing old keys failed", err);
  }
}
