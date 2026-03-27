"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-white/70 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={3}
          className={cn(
            "w-full rounded-xl px-4 py-2.5 text-sm text-white/90 resize-none",
            "bg-white/[0.07] border border-white/15",
            "backdrop-blur-xl",
            "placeholder:text-white/30",
            "outline-none transition-all duration-200",
            "focus:bg-white/[0.10] focus:border-white/30 focus:ring-1 focus:ring-white/20",
            error && "border-[#FF3B30]/60",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-[#FF3B30]">{error}</p>}
      </div>
    );
  }
);
GlassTextarea.displayName = "GlassTextarea";

export { GlassTextarea };
