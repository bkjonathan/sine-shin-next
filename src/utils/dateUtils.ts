// ── Date parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a date string in YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY format.
 * Returns a YYYY-MM-DD string or null on failure.
 */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

// ── Month bounds ──────────────────────────────────────────────────────────────

/**
 * Returns the start and end date strings for the current calendar month.
 * Both as YYYY-MM-DD strings suitable for string comparison against date fields.
 */
export function getThisMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();

  return {
    start: `${y}-${m}-01`,
    end:   `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

// ── Date field accessor ───────────────────────────────────────────────────────

type HasDates = {
  orderDate?: string | null;
  createdAt?: string | Date | null;
};

export function getDateFieldValue(
  record: HasDates,
  field: "order_date" | "created_at"
): string | null {
  if (field === "order_date") {
    return record.orderDate ?? null;
  }
  const ca = record.createdAt;
  if (!ca) return null;
  if (typeof ca === "string") return ca.slice(0, 10);
  return ca.toISOString().slice(0, 10);
}

// ── Order date filter ─────────────────────────────────────────────────────────

export function isInDateRange(
  dateStr: string | null | undefined,
  from: string | null,
  to: string | null
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10); // normalize to YYYY-MM-DD
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
}

// ── Period to date range ──────────────────────────────────────────────────────

type Period = "week" | "month" | "3months" | "6months" | "year" | "custom";

export function periodToDates(period: Period): { from: string; to: string } | null {
  if (period === "custom") return null;

  const now = new Date();
  const to  = now.toISOString().slice(0, 10);
  let from: Date;

  switch (period) {
    case "week":    from = new Date(now); from.setDate(now.getDate() - 6); break;
    case "month":   from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "3months": from = new Date(now); from.setMonth(now.getMonth() - 3); break;
    case "6months": from = new Date(now); from.setMonth(now.getMonth() - 6); break;
    case "year":    from = new Date(now.getFullYear(), 0, 1); break;
    default:        return null;
  }

  return { from: from.toISOString().slice(0, 10), to };
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstOfMonthStr(): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}
