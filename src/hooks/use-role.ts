"use client";

import { useSession } from "next-auth/react";
import { hasRole, type Role } from "@/lib/roles";

/**
 * Whether the signed-in user's role is at least `min`. Only decides what to
 * render: route handlers enforce access themselves (AUDIT.md F-04, F-12).
 */
export function useHasRole(min: Role) {
  const { data: session } = useSession();
  return hasRole((session?.user as { role?: string } | undefined)?.role, min);
}
