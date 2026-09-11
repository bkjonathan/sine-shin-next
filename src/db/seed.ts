/**
 * Database seed script — creates initial admin user and shop settings.
 * Run with: npm run db:seed
 *
 * Usage: DATABASE_URL=postgresql://... [SEED_OWNER_PASSWORD=...] npm run db:seed
 *
 * The owner password comes from SEED_OWNER_PASSWORD (at least
 * PASSWORD_MIN_LENGTH characters); if unset, a random one is generated and
 * printed once. There is no default password (AUDIT.md F-08).
 */
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { nanoid } from "nanoid";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import { PASSWORD_MIN_LENGTH } from "../validations/user.schema";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("🌱 Seeding database...");

  // Create default shop settings
  const existingSettings = await db
    .select()
    .from(schema.shopSettings)
    .where(eq(schema.shopSettings.id, "singleton"))
    .limit(1);

  if (existingSettings.length === 0) {
    await db.insert(schema.shopSettings).values({
      id: "singleton",
      shopName: "My Shop",
      customerIdPrefix: "CUST",
      orderIdPrefix: "ORD",
    });
    console.log("✅ Created default shop settings");
  } else {
    console.log("⏭️  Shop settings already exist");
  }

  // Create admin user
  const existingAdmin = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, "admin"))
    .limit(1);

  if (existingAdmin.length === 0) {
    const provided = process.env.SEED_OWNER_PASSWORD;
    if (provided !== undefined && provided.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`SEED_OWNER_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    const password = provided ?? randomBytes(15).toString("base64url");
    const passwordHash = await hash(password, 12);
    await db.insert(schema.users).values({
      id: nanoid(),
      username: "admin",
      passwordHash,
      role: "owner",
    });
    console.log("✅ Created admin user (username: admin)");
    if (provided === undefined) {
      console.log(`🔑 Generated password (shown once, store it now): ${password}`);
    }
    console.log("⚠️  Change the admin password after first login!");
  } else {
    console.log("⏭️  Admin user already exists");
  }

  await client.end();
  console.log("🎉 Seed complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
