"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { DashboardDateField } from "@/types/dashboard";

export type Period = "week" | "month" | "3months" | "6months" | "year" | "custom";

const PERIODS: { label: string; value: Period }[] = [
  { label: "This Week",  value: "week"    },
  { label: "This Month", value: "month"   },
  { label: "3 Months",   value: "3months" },
  { label: "6 Months",   value: "6months" },
  { label: "This Year",  value: "year"    },
  { label: "Custom",     value: "custom"  },
];

const DATE_FIELDS: { label: string; value: DashboardDateField }[] = [
  { label: "Order Date",   value: "order_date"  },
  { label: "Created Date", value: "created_at"  },
];

const ORDER_STATUS_OPTIONS = [
  { label: "All",       value: "" },
  { label: "Pending",   value: "pending"    },
  { label: "Confirmed", value: "confirmed"  },
  { label: "Shipping",  value: "shipping"   },
  { label: "Completed", value: "completed"  },
  { label: "Cancelled", value: "cancelled"  },
];

const STATUS_DOT: Record<string, string> = {
  "":          "bg-t3",
  pending:     "bg-ios-amber",
  confirmed:   "bg-accent",
  shipping:    "bg-ios-purple",
  completed:   "bg-ios-green",
  cancelled:   "bg-[#FF3B30]",
};

interface DashboardFiltersProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
  dateField: DashboardDateField;
  onDateFieldChange: (f: DashboardDateField) => void;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
}

export function DashboardFilters({
  period,
  onPeriodChange,
  dateField,
  onDateFieldChange,
  statusFilter,
  onStatusChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
}: DashboardFiltersProps) {
  const [showDateField, setShowDateField] = useState(false);
  const activeDateFieldLabel =
    DATE_FIELDS.find((f) => f.value === dateField)?.label ?? "Date Field";

  return (
    <GlassCard padding="sm" className="space-y-3">
      {/* Period + date field */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
              period === p.value
                ? "bg-accent text-white [box-shadow:0_2px_8px_var(--accent-shadow)]"
                : "text-t2 hover:text-t1 hover:bg-surface border border-line"
            )}
          >
            {p.label}
          </button>
        ))}

        {/* Date field dropdown */}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowDateField((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-t2 hover:text-t1 hover:bg-surface transition-all duration-150"
          >
            <Calendar className="h-3.5 w-3.5" />
            {activeDateFieldLabel}
          </button>
          {showDateField && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-line rounded-xl shadow-lg overflow-hidden min-w-[160px]">
              {DATE_FIELDS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    onDateFieldChange(f.value);
                    setShowDateField(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs transition-colors",
                    dateField === f.value
                      ? "text-accent bg-accent-bg"
                      : "text-t2 hover:text-t1 hover:bg-surface-hover"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-t3">From</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-line bg-surface text-t1 focus:outline-none focus:border-accent-border"
          />
          <span className="text-xs text-t3">To</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-line bg-surface text-t1 focus:outline-none focus:border-accent-border"
          />
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold tracking-widest text-t4 uppercase">Status</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ORDER_STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => onStatusChange(s.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                statusFilter === s.value
                  ? "border-accent-border bg-accent-bg text-accent"
                  : "border-line text-t2 hover:text-t1 hover:bg-surface"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full inline-block",
                  STATUS_DOT[s.value] ?? "bg-t3"
                )}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
