// Turns audit_log rows (AUDIT.md F-14) into what Settings → Activity shows.
//
// No imports: shared by the page and tests.

type Row = Record<string, unknown> | null | undefined;

/** Columns that change on every edit and would only add noise. */
const BOOKKEEPING = new Set(["updated_at", "created_at"]);

/** A plain-English label for one entry; soft deletes are updates of deleted_at. */
export function auditActionLabel(action: string, before: Row, after: Row): string {
  if (action === "insert") return "Created";
  if (action === "delete") return "Deleted permanently";
  const wasDeleted = before?.deleted_at != null;
  const isDeleted = after?.deleted_at != null;
  if (!wasDeleted && isDeleted) return "Moved to trash";
  if (wasDeleted && !isDeleted) return "Restored";
  return "Changed";
}

/** The fields whose value differs between the two rows, in column order. */
export function auditChanges(before: Row, after: Row): { field: string; from: unknown; to: unknown }[] {
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const field of Object.keys({ ...before, ...after })) {
    if (BOOKKEEPING.has(field)) continue;
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from, to });
  }
  return changes;
}

// The column that names a record of each kind, e.g. an order's display number.
const LABEL_FIELD: Record<string, string> = {
  orders: "order_id",
  order_items: "product_url",
  customers: "name",
  expenses: "title",
  cargo_shipments: "cargo_no",
  cargo_items: "public_code",
  cargo_expenses: "description",
  cargo_categories: "name",
  shop_settings: "shop_name",
  users: "name",
};

/** A short name for the record an entry is about, from whichever row exists. */
export function auditRecordLabel(entity: string, before: Row, after: Row): string | null {
  const row = after ?? before;
  if (!row) return null;
  if (entity === "cargo_payments") return `${row.amount} ${row.currency}`;
  const value = LABEL_FIELD[entity] ? row[LABEL_FIELD[entity]] : null;
  return value == null || value === "" ? null : String(value);
}
