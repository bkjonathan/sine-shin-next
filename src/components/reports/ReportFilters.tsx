"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportPeriod = "month" | "3months" | "6months" | "year" | "all" | "custom";

interface ReportFiltersProps {
  period: ReportPeriod;
  onPeriodChange: (p: ReportPeriod) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
}

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "3months", label: "3 Months" },
  { value: "6months", label: "6 Months" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

export function ReportFilters({
  period,
  onPeriodChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
}: ReportFiltersProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentLabel = PERIODS.find((p) => p.value === period)?.label ?? "This Month";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-t1 transition hover:bg-surface-hover hover:border-line-strong"
        >
          <Calendar className="h-4 w-4 text-accent" />
          {currentLabel}
          <ChevronDown className={cn("h-3.5 w-3.5 text-t3 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
              aria-label="Close dropdown"
            />
            <div className="absolute left-0 top-full z-50 mt-2 min-w-[160px] rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    onPeriodChange(p.value);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-xl px-3.5 py-2 text-left text-sm font-medium transition",
                    period === p.value
                      ? "bg-accent-bg text-accent"
                      : "text-t2 hover:bg-surface-hover hover:text-t1"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="rounded-xl border border-line bg-field px-3 py-2 text-sm text-t1 outline-none focus:border-accent-border"
          />
          <span className="text-xs text-t3">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="rounded-xl border border-line bg-field px-3 py-2 text-sm text-t1 outline-none focus:border-accent-border"
          />
        </div>
      )}
    </div>
  );
}
