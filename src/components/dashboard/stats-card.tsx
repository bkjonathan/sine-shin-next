import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "blue" | "green" | "red" | "amber";
  trend?: { value: number; label: string };
}

const colorMap = {
  blue: "text-[#007AFF] bg-[#007AFF]/15 border-[#007AFF]/25",
  green: "text-[#34C759] bg-[#34C759]/15 border-[#34C759]/25",
  red: "text-[#FF3B30] bg-[#FF3B30]/15 border-[#FF3B30]/25",
  amber: "text-[#FF9F0A] bg-[#FF9F0A]/15 border-[#FF9F0A]/25",
};

export function StatsCard({ title, value, subtitle, icon: Icon, color = "blue", trend }: StatsCardProps) {
  return (
    <GlassCard hover className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/50">{title}</p>
        <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center", colorMap[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white/90">{value}</p>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className={trend.value >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
          <span className="text-white/40">{trend.label}</span>
        </div>
      )}
    </GlassCard>
  );
}
