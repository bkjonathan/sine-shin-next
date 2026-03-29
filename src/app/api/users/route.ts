import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isNull, ilike, desc, asc, sql, and, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hash } from "bcryptjs";
import { createUserSchema } from "@/validations/user.schema";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const sort = searchParams.get("sort") ?? "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const searchClause = search ? ilike(users.username, `%${search}%`) : undefined;
    const sortCol = sort === "username" ? users.username : sort === "role" ? users.role : users.createdAt;
    const orderFn = order === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(searchClause ?? undefined)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(searchClause ?? undefined),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.username, parsed.data.username))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const passwordHash = await hash(parsed.data.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        id: nanoid(),
        username: parsed.data.username,
        passwordHash,
        role: parsed.data.role,
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
