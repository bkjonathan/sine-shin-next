/**
 * Database seed script — creates initial admin user and shop settings.
 * Run with: npm run db:seed
 *
 * Usage: DATABASE_URL=postgresql://... npm run db:seed
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { nanoid } from "nanoid";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

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
      currency: "USD",
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
    const passwordHash = await hash("admin123", 12);
    await db.insert(schema.users).values({
      id: nanoid(),
      username: "admin",
      passwordHash,
      role: "owner",
    });
    console.log("✅ Created admin user (username: admin, password: admin123)");
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
