"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
  loading?: boolean;
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // sizes
          size === "sm" && "h-8 px-3 text-xs",
          size === "md" && "h-10 px-4 text-sm",
          size === "lg" && "h-12 px-6 text-base",
          // variants
          variant === "primary" && [
            "bg-[#007AFF] text-white",
            "shadow-[0_4px_16px_rgba(0,122,255,0.3)]",
            "hover:bg-[#0066d6] active:scale-95",
          ],
          variant === "secondary" && [
            "bg-white/[0.12] text-white/90 border border-white/15",
            "backdrop-blur-xl",
            "hover:bg-white/[0.18] hover:border-white/25 active:scale-95",
          ],
          variant === "ghost" && [
            "text-white/70",
            "hover:bg-white/[0.08] hover:text-white/90 active:scale-95",
          ],
          variant === "danger" && [
            "bg-[#FF3B30] text-white",
            "shadow-[0_4px_16px_rgba(255,59,48,0.3)]",
            "hover:bg-[#e0352a] active:scale-95",
          ],
          className
        )}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
GlassButton.displayName = "GlassButton";

export { GlassButton };
