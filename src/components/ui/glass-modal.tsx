"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function GlassModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
}: GlassModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color:var(--bg-overlay)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100%-1.5rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-[28px]",
            "bg-panel backdrop-blur-3xl",
            "border border-line",
            "shadow-[var(--shadow-card-hover)]",
            "p-5 sm:p-6",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            size === "sm" && "max-w-sm",
            size === "md" && "max-w-lg",
            size === "lg" && "max-w-2xl",
            size === "xl" && "max-w-4xl",
            className
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              {title && (
                <Dialog.Title className="text-lg font-semibold text-t1">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="mt-1 text-sm text-t2">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-xl p-2 text-t3 transition-colors hover:bg-surface hover:text-t1">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
