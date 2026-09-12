import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/db";
import { clientIp } from "@/lib/auth";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs a route handler's writes in one transaction and tells the audit_log
 * triggers who is making them (AUDIT.md F-14). The triggers record every row
 * this transaction changes with this user, role and client address; if `fn`
 * throws, the changes and their log rows roll back together. Every route
 * handler write goes through here: tests/f14-audit-log.test.mjs fails on a
 * write made with `db` directly.
 */
export function withAudit<T>(req: Request, session: Session, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const user = session.user as { id?: string; role?: string } | undefined;
  return db.transaction(async (tx) => {
    // is_local = true: the settings end with this transaction.
    await tx.execute(sql`
      select set_config('app.user_id', ${user?.id ?? ""}, true),
             set_config('app.user_role', ${user?.role ?? ""}, true),
             set_config('app.client_ip', ${clientIp(req)}, true)`);
    return fn(tx);
  });
}
