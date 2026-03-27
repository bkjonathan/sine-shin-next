"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-t2">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full rounded-2xl px-4 py-3 text-sm text-t1",
            "bg-field border border-line",
            "backdrop-blur-xl",
            "placeholder:text-t4",
            "outline-none transition-all duration-200",
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12)]",
            "focus:border-accent-border focus:bg-[var(--bg-panel)] focus:ring-4 focus:ring-accent-bg/60",
            error && "border-[rgba(255,59,48,0.55)] focus:border-[rgba(255,59,48,0.7)] focus:ring-[rgba(255,59,48,0.14)]",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-t3">{hint}</p>}
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";

export { GlassInput };
