import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative isolate overflow-hidden rounded-[28px] border border-line bg-surface backdrop-blur-2xl",
          "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/60 before:opacity-50",
          "transition-[transform,background-color,border-color,box-shadow] duration-300",
          "[box-shadow:var(--shadow-card)]",
          hover && "hover:-translate-y-1 hover:bg-surface-hover hover:border-line-strong hover:[box-shadow:var(--shadow-card-hover)]",
          padding === "sm" && "p-4",
          padding === "md" && "p-6",
          padding === "lg" && "p-8",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
