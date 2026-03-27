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
          <p className="text-center py-8 text-sm text-white/50">No records for this metric.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/40">Order ID</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/40">Customer</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/40 text-right">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/40">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-white/70">
                        {r.order_id ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {r.customer_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white/90">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {r.order_date ? formatDate(r.order_date, "d MMM yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/20 bg-white/5">
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white/40">
                      Total ({records.length} orders)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
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
