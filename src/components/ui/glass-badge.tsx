import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[#007AFF]/20 text-[#007AFF] border-[#007AFF]/30",
  success: "bg-[#34C759]/20 text-[#34C759] border-[#34C759]/30",
  warning: "bg-[#FF9F0A]/20 text-[#FF9F0A] border-[#FF9F0A]/30",
  danger: "bg-[#FF3B30]/20 text-[#FF3B30] border-[#FF3B30]/30",
  info: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  neutral: "bg-white/10 text-white/60 border-white/15",
};

export function GlassBadge({ variant = "default", className, children, ...props }: GlassBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
