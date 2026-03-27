import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, shopSettings, orderItems } from "@/db/schema";
import { isNull, desc, asc, sql, eq, and, ilike } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createOrderSchema } from "@/validations/order.schema";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const searchField = searchParams.get("searchField") ?? "orderId";
    const status = searchParams.get("status") ?? "";
    const sort = searchParams.get("sort") ?? "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const baseConditions = [isNull(orders.deletedAt)];
    if (status) baseConditions.push(eq(orders.status, status));
    if (search) {
      baseConditions.push(
        searchField === "customerName"
          ? ilike(customers.name, `%${search}%`)
          : ilike(orders.orderId, `%${search}%`)
      );
    }
    const whereClause = and(...(baseConditions as Parameters<typeof and>));

    const sortCol =
      sort === "status" ? orders.status :
      sort === "orderId" ? orders.orderId :
      orders.createdAt;
    const orderFn = order === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderId: orders.orderId,
          customerId: orders.customerId,
          status: orders.status,
          shippingFee: orders.shippingFee,
          deliveryFee: orders.deliveryFee,
          cargoFee: orders.cargoFee,
          serviceFee: orders.serviceFee,
          exchangeRate: orders.exchangeRate,
          createdAt: orders.createdAt,
          deletedAt: orders.deletedAt,
          customerName: customers.name,
          customerDisplayId: customers.customerId,
          totalQty: sql<number>`(SELECT COALESCE(SUM(oi.product_qty), 0)::int FROM order_items oi WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL)`,
          totalWeight: sql<number>`(SELECT COALESCE(SUM(oi.product_weight), 0) FROM order_items oi WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL)`,
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(whereClause)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(distinct ${orders.id})::int` })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(whereClause),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { items, ...orderData } = parsed.data;

    const [settings] = await db.select().from(shopSettings).where(eq(shopSettings.id, "singleton")).limit(1);
    const prefix = settings?.orderIdPrefix ?? "ORD";
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
    const orderId = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    const orderId_ = nanoid();
    const [createdOrder] = await db.insert(orders).values({
      id: orderId_,
      orderId,
      ...orderData,
    }).returning();

    if (items && items.length > 0) {
      await db.insert(orderItems).values(
        items.map((item) => ({
          id: nanoid(),
          orderId: orderId_,
          productUrl: item.productUrl,
          productQty: item.productQty,
          price: item.price,
          productWeight: item.productWeight,
        }))
      );
    }

    return NextResponse.json({ data: createdOrder }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
