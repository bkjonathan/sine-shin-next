"use client";

import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import type { DashboardRecordType } from "@/types/dashboard";

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
  dot?: string;
  recordType?: DashboardRecordType;
  onDrilldown?: (type: DashboardRecordType) => void;
}

export function DashboardStatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconText,
  dot,
  recordType,
  onDrilldown,
}: DashboardStatCardProps) {
  const clickable = !!recordType && !!onDrilldown;

  return (
    <GlassCard
      hover
      className={cn(
        "flex flex-col gap-3 relative overflow-hidden",
        clickable && "cursor-pointer active:scale-[0.98] transition-transform"
      )}
      onClick={clickable ? () => onDrilldown!(recordType!) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDrilldown!(recordType!);
              }
            }
          : undefined
      }
    >
      {dot && (
        <span className={cn("absolute top-3 right-3 w-2 h-2 rounded-full", dot)} />
      )}
      {clickable && (
        <span className="absolute top-3 right-3 text-[10px] font-medium text-t4 uppercase tracking-widest">
          {dot && <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", dot)} />}
          details
        </span>
      )}
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", iconBg)}>
        <Icon className={cn("h-5 w-5", iconText)} />
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest text-t3 uppercase">{label}</p>
        <p className="text-2xl font-bold text-t1 mt-1">{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </GlassCard>
  );
}
