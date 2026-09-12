import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";

// Settings → Activity: the change history, newest first. Owner only, like
// Users and shop settings (AUDIT.md F-14).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAtLeast(session, "owner")) return forbidden();

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50) || 50));
    const entity = searchParams.get("entity");
    const entityId = searchParams.get("entityId");

    const where = and(
      entity ? eq(auditLog.entity, entity) : undefined,
      entityId ? eq(auditLog.entityId, entityId) : undefined,
    );

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: auditLog.id,
          at: auditLog.at,
          userId: auditLog.userId,
          userRole: auditLog.userRole,
          clientIp: auditLog.clientIp,
          dbUser: auditLog.dbUser,
          action: auditLog.action,
          entity: auditLog.entity,
          entityId: auditLog.entityId,
          before: auditLog.before,
          after: auditLog.after,
          // null once the acting user has been deleted; the id stays in userId.
          username: users.username,
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .where(where)
        .orderBy(desc(auditLog.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/audit-log]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
