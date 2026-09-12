// Role hierarchy shared by route handlers and client components (AUDIT.md F-04,
// F-12). Route handlers enforce access with roleAtLeast() in src/lib/auth.ts;
// client components use hasRole() only to decide what to render.
//
// No imports: shared by server code, client components and tests.

export type Role = "owner" | "manager" | "staff";

// Roles are hierarchical: owner outranks manager outranks staff.
const ROLE_RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

/** True when `role` is at least `min` in the owner > manager > staff hierarchy. */
export function hasRole(role: string | null | undefined, min: Role): boolean {
  // hasOwnProperty rather than Object.hasOwn, which older phone browsers lack.
  return !!role && Object.prototype.hasOwnProperty.call(ROLE_RANK, role) && ROLE_RANK[role as Role] >= ROLE_RANK[min];
}

/**
 * Who may see shop-wide money summaries: revenue, shop income, profit, expense
 * totals and cargo cost/revenue totals — Reports, the Account Book, the
 * dashboard's money cards and the expense summary (agreed with the owner on
 * 2026-09-12). Staff keep the individual records they work with, so this hides
 * summaries; it can't stop someone adding those records up.
 */
export const FINANCIAL_SUMMARY_ROLE: Role = "manager";
