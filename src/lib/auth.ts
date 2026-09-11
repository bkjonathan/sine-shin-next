import NextAuth, { CredentialsSignin } from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createAttemptLimiter } from "@/lib/attempt-limiter";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(128),
});

// Failed sign-ins are limited per IP+username, so one person mistyping doesn't
// lock out a whole shop behind one address, and per IP, so one address can't
// spray many usernames. Blocked attempts skip the database and bcrypt (F-07).
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailuresByIpAndUser = createAttemptLimiter({ maxFailures: 5, windowMs: LOGIN_WINDOW_MS, blockMs: LOGIN_WINDOW_MS });
const loginFailuresByIp = createAttemptLimiter({ maxFailures: 20, windowMs: LOGIN_WINDOW_MS, blockMs: LOGIN_WINDOW_MS });

// bcrypt (cost 12, as for real accounts) of a random string nobody knows.
// Checked when the username doesn't exist, so a miss takes as long as a wrong
// password and response time doesn't reveal which usernames are valid (F-07).
const DUMMY_PASSWORD_HASH = "$2b$12$rdB5hNXnMau8IJRDv1IiDeVrnnu5roHF.C.lIYsY2pKizcWmEY1la";

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

// The proxy in front (Traefik) puts the connecting client's address last in
// X-Forwarded-For, and Next.js only sets the header when it's absent, so the
// last entry is the one a client can't forge through the proxy. A client that
// reaches the app port directly can forge it (AUDIT.md F-31).
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const ip = clientIp(request);
        const ipAndUser = `${ip}|${username.toLowerCase()}`;
        if (loginFailuresByIp.isBlocked(ip) || loginFailuresByIpAndUser.isBlocked(ipAndUser)) {
          throw new TooManyAttempts();
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        const passwordMatch = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !passwordMatch) {
          loginFailuresByIp.recordFailure(ip);
          loginFailuresByIpAndUser.recordFailure(ipAndUser);
          return null;
        }
        loginFailuresByIpAndUser.reset(ipAndUser);

        return {
          id: user.id,
          name: user.username,
          email: user.username,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  // Idle timeout: the JWT is re-issued on every request, so this signs a user
  // out after 12 hours without activity rather than every 12 hours (F-06).
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "staff";
        token.sv = (user as { sessionVersion?: number }).sessionVersion;
        return token;
      }
      // Re-check the user on every request so deleting them, or bumping their
      // session version on a role/password change, ends their sessions at once,
      // and the role is always the current one. Returning null signs the caller
      // out; tokens issued before session versions existed carry no `sv` (F-06).
      if (typeof token.id !== "string" || typeof token.sv !== "number") return null;
      const [current] = await db
        .select({ role: users.role, sessionVersion: users.sessionVersion })
        .from(users)
        .where(eq(users.id, token.id))
        .limit(1);
      if (!current || current.sessionVersion !== token.sv) return null;
      token.role = current.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

/**
 * Server-side auth gate for pages, layouts and server components. Verifies the
 * session and, when there is none, redirects to /login before any caller code
 * runs; otherwise returns the session. Call this at the data source rather than
 * relying on middleware or a parent layout alone — a layout check is skipped on
 * client-side navigation, and middleware coverage can be lost to a matcher or
 * routing change (AUDIT.md F-02).
 */
export async function requireSession() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}

export type Role = "owner" | "manager" | "staff";

// Roles are hierarchical: owner outranks manager outranks staff.
const ROLE_RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

/**
 * True when the session's role is at least `min` in the owner > manager > staff
 * hierarchy. Use in route handlers to authorise writes — every server action
 * and route handler must authorise the caller itself (AUDIT.md F-04).
 */
export function roleAtLeast(session: Session | null, min: Role): boolean {
  const role = (session?.user as { role?: string } | undefined)?.role;
  return !!role && (ROLE_RANK[role as Role] ?? 0) >= ROLE_RANK[min];
}

/** Standard 403 for a caller who is authenticated but lacks the required role. */
export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
