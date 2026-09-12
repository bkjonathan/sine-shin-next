import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * What's wrong with the server's settings, one line per problem, naming the
 * setting but never its value, since the lines are logged. Empty when all is
 * well. src/instrumentation.ts runs it when the server starts and refuses to
 * start on any problem (AUDIT.md F-29). It doesn't run on import, because
 * `next build` runs without the runtime settings.
 */
export function envProblems(env: Record<string, string | undefined> = process.env): string[] {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}
