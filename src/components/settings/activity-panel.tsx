"use client";

import { useState } from "react";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassButton } from "@/components/ui/glass-button";
import { useAuditLog, type AuditLogEntry } from "@/hooks/use-audit-log";
import { auditActionLabel, auditChanges, auditRecordLabel } from "@/lib/audit-format";
import { cn, formatDate } from "@/lib/utils";

const ENTITIES = [
  { value: "all", label: "All records" },
  { value: "orders", label: "Orders" },
  { value: "order_items", label: "Order items" },
  { value: "customers", label: "Customers" },
  { value: "expenses", label: "Expenses" },
  { value: "cargo_shipments", label: "Cargo shipments" },
  { value: "cargo_items", label: "Cargo items" },
  { value: "cargo_payments", label: "Cargo payments" },
  { value: "cargo_expenses", label: "Cargo expenses" },
  { value: "cargo_categories", label: "Cargo categories" },
  { value: "shop_settings", label: "Shop settings" },
  { value: "users", label: "Users" },
];
const ENTITY_LABEL: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.value, e.label]));

const ACTION_COLORS: Record<string, string> = {
  "Created":             "bg-green-500/15 text-green-400",
  "Changed":             "bg-blue-500/15 text-blue-400",
  "Moved to trash":      "bg-amber-500/15 text-amber-400",
  "Restored":            "bg-purple-500/15 text-purple-400",
  "Deleted permanently": "bg-red-500/15 text-red-400",
};

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function ActivityEntry({ entry }: { entry: AuditLogEntry }) {
  const label = auditActionLabel(entry.action, entry.before, entry.after);
  const record = auditRecordLabel(entry.entity, entry.before, entry.after);
  const changes = entry.action === "update" ? auditChanges(entry.before, entry.after) : [];
  const who = entry.username ?? entry.userId ?? `Outside the app (${entry.dbUser})`;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-medium", ACTION_COLORS[label])}>{label}</span>
        <span className="text-sm font-medium text-t1">{ENTITY_LABEL[entry.entity] ?? entry.entity}</span>
        {record && <span className="max-w-[16rem] truncate text-sm text-t2">{record}</span>}
      </div>
      <p className="mt-0.5 text-xs text-t3">
        {formatDate(entry.at, "MMM d, yyyy HH:mm")} · {who}
        {entry.userRole && ` (${entry.userRole})`}
        {entry.clientIp && ` · ${entry.clientIp}`}
      </p>
      {changes.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {changes.map((c) => (
            <li key={c.field} className="text-xs text-t2">
              <span className="text-t3">{c.field.replace(/_/g, " ")}:</span> {show(c.from)} → {show(c.to)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Settings → Activity: every change to shop data, newest first (owner only; AUDIT.md F-14). */
export function ActivityPanel() {
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog({ page, entity: entity === "all" ? undefined : entity });
  const entries = data?.data ?? [];
  const totalPages = Math.max(1, data?.meta?.totalPages ?? 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-t3">
          Who changed what, when, and what it was before. Entries can&apos;t be edited or deleted.
        </p>
        <div className="w-48">
          <GlassSelect options={ENTITIES} value={entity} onValueChange={(v) => { setEntity(v); setPage(1); }} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-t3">Loading activity…</div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-t3">No activity recorded yet.</div>
      ) : (
        <div className="divide-y divide-divide overflow-hidden rounded-2xl border border-line">
          {entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} />)}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</GlassButton>
        <span className="text-xs text-t3">Page {page} of {totalPages}</span>
        <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</GlassButton>
      </div>
    </div>
  );
}
