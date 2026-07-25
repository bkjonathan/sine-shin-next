import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoCategories } from "@/db/schema";
import { isNull, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createCargoCategorySchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(cargoCategories)
    .where(isNull(cargoCategories.deletedAt))
    .orderBy(asc(cargoCategories.name));

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCargoCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [created] = await db.insert(cargoCategories).values({
      id: nanoid(),
      ...parsed.data,
    }).returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cargo-categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
