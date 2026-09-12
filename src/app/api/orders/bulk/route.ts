import { NextRequest, NextResponse } from "next/server";
import { orders } from "@/db/schema";
import { and, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES } from "@/validations/order.schema";
import { LIST_LIMIT, MAX_ID, MAX_LIST } from "@/validations/limits";
import { auth } from "@/lib/auth";
import { withAudit } from "@/lib/audit";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1).max(MAX_ID)).min(1, "At least one order is required").max(MAX_LIST, LIST_LIMIT),
  status: z.enum(ORDER_STATUSES),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { ids, status } = parsed.data;

    const updated = await withAudit(req, session, (tx) => tx
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(and(inArray(orders.id, ids), isNull(orders.deletedAt)))
      .returning({ id: orders.id }));

    return NextResponse.json({ data: { count: updated.length, ids: updated.map((o) => o.id) } });
  } catch (err) {
    console.error("[PATCH /api/orders/bulk]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
