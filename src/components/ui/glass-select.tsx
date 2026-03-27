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
        <label htmlFor={id} className="block text-sm font-medium text-white/70 mb-1.5">
          {label}
        </label>
      )}
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          className={cn(
            "flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm",
            "bg-white/[0.07] border border-white/15 text-white/90",
            "backdrop-blur-xl",
            "outline-none transition-all duration-200",
            "focus:bg-white/[0.10] focus:border-white/30",
            "data-[placeholder]:text-white/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[#FF3B30]/60",
            className
          )}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-white/40" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="z-50 rounded-xl overflow-hidden bg-[rgba(15,15,20,0.95)] backdrop-blur-2xl border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1.5 max-h-60">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 cursor-pointer outline-none select-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3">
                    <Check className="h-3.5 w-3.5 text-[#007AFF]" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {error && <p className="mt-1.5 text-xs text-[#FF3B30]">{error}</p>}
    </div>
  );
}
