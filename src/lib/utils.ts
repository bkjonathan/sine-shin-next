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
  symbol = "$",
  locale = "en-US"
): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol} ${formatted}`;
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
 * Escapes a value for insertion into HTML text or a quoted attribute. Use for
 * any value written into markup outside React (e.g. document.write into a print
 * window), where React's own escaping doesn't apply (AUDIT.md F-05).
 */
export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns `value` as a same-origin path (path + query + hash) when it is a
 * relative URL that resolves to `origin`, otherwise `fallback`. Resolving with
 * the browser's own URL parser defeats "//host", "/\host" and control-character
 * tricks. Use for any redirect target taken from the URL (AUDIT.md F-16).
 */
export function safeRedirectPath(
  value: string | null | undefined,
  origin: string,
  fallback = "/dashboard"
): string {
  if (!value || !value.startsWith("/")) return fallback;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
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
