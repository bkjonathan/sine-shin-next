import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

/**
 * Merges Tailwind classes safely, resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as currency using Intl.NumberFormat.
 */
export function formatCurrency(
  amount: number,
  locale = "en-US"
): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$ ${formatted}`;
}

/**
 * Formats a Date or ISO string using date-fns.
 */
export function formatDate(
  date: Date | string | null | undefined,
  pattern = "MMM d, yyyy"
): string {
  if (!date) return "—";
  try {
    return format(typeof date === "string" ? new Date(date) : date, pattern);
  } catch {
    return "—";
  }
}

/**
 * Checks if the current user has the given role.
 */
export function hasRole(userRole: string | undefined, required: string): boolean {
  const hierarchy: Record<string, number> = { owner: 10, staff: 1 };
  return (hierarchy[userRole ?? ""] ?? 0) >= (hierarchy[required] ?? Infinity);
}

/**
 * Generates a sequential display ID with a prefix.
 */
export function generateDisplayId(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(4, "0")}`;
}
