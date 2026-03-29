import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Prevent multiple instances in development (HMR)
const globalForDb = globalThis as unknown as {
  _pgClient: postgres.Sql | undefined;
};

const client = globalForDb._pgClient ?? postgres(connectionString, {
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connect_timeout: 10,
});
if (process.env.NODE_ENV !== "production") globalForDb._pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
