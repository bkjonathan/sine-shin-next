"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function GlassSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  label,
  error,
  disabled,
  className,
}: GlassSelectProps) {
  const id = useId();
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-t2">
          {label}
        </label>
      )}
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm",
            "bg-field border border-line text-t1",
            "backdrop-blur-xl",
            "outline-none transition-all duration-200",
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12)]",
            "focus:border-accent-border focus:bg-[var(--bg-panel)] focus:ring-4 focus:ring-accent-bg/60",
            "data-[placeholder]:text-t4",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[rgba(255,59,48,0.55)] focus:border-[rgba(255,59,48,0.7)] focus:ring-[rgba(255,59,48,0.14)]",
            className
          )}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-t3" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 overflow-hidden rounded-2xl border border-line bg-panel backdrop-blur-2xl shadow-[var(--shadow-card)]"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1.5 max-h-60">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-t2 outline-none select-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-t1"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3">
                    <Check className="h-3.5 w-3.5 text-accent" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
