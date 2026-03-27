import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "red" | "amber" | "purple";
  trend?: { value: number; label: string };
}

const colorMap = {
  blue:   "text-[#007AFF] bg-[#007AFF]/15 border-[#007AFF]/25",
  green:  "text-[#30D158] bg-[#30D158]/15 border-[#30D158]/25",
  red:    "text-[#FF3B30] bg-[#FF3B30]/15 border-[#FF3B30]/25",
  amber:  "text-[#FF9F0A] bg-[#FF9F0A]/15 border-[#FF9F0A]/25",
  purple: "text-[#AF52DE] bg-[#AF52DE]/15 border-[#AF52DE]/25",
};

export function StatsCard({ title, value, subtitle, icon: Icon, color = "blue", trend }: StatsCardProps) {
  return (
    <GlassCard hover className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-widest text-t3 uppercase">{title}</p>
        <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center", colorMap[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-t1">{value}</p>
        {subtitle && <p className="text-xs text-t3 mt-0.5">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={trend.value >= 0 ? "text-ios-green" : "text-ios-red"}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-t3">{trend.label}</span>
        </div>
      )}
    </GlassCard>
  );
}
