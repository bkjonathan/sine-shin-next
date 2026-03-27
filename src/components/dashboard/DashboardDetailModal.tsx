"use client";

import { GlassModal } from "@/components/ui/glass-modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DashboardDetailRecord, DashboardRecordType } from "@/types/dashboard";

const RECORD_TYPE_LABELS: Record<DashboardRecordType, string> = {
  profit:          "Order Profit Breakdown",
  cargo:           "Total Cargo Fees",
  paid_cargo:      "Paid Cargo Fees",
  unpaid_cargo:    "Unpaid Cargo Fees",
  excluded_cargo:  "Excluded Cargo Fees",
};

interface DashboardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DashboardRecordType | null;
  records: DashboardDetailRecord[];
}

export function DashboardDetailModal({
  open,
  onOpenChange,
  type,
  records,
}: DashboardDetailModalProps) {
  const title = type ? RECORD_TYPE_LABELS[type] : "Details";
  const total = records.reduce((s, r) => s + r.amount, 0);

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} title={title} size="lg">
      <div className="mt-2">
        {records.length === 0 ? (
          <p className="py-8 text-center text-sm text-t3">No records for this metric.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[24px] border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divide text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-t3">Order ID</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-t3">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-t3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-divide transition-colors hover:bg-surface-hover"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-t2">
                        {r.order_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-t1">
                        {r.customer_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-t1">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-t3">
                        {r.order_date ? formatDate(r.order_date, "d MMM yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-divide bg-topbar">
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-t3">
                      Total ({records.length} orders)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-t1">
                      {formatCurrency(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </GlassModal>
  );
}
