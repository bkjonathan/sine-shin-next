import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "border-accent-border bg-accent-bg text-accent",
  success: "border-[rgba(49,201,126,0.25)] bg-[rgba(49,201,126,0.14)] text-success",
  warning: "border-[rgba(255,176,32,0.25)] bg-[rgba(255,176,32,0.14)] text-warning",
  danger: "border-[rgba(255,92,92,0.25)] bg-[rgba(255,92,92,0.14)] text-danger",
  info: "border-[rgba(50,184,255,0.25)] bg-[rgba(50,184,255,0.14)] text-info",
  neutral: "border-line bg-surface-hover text-t2",
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
