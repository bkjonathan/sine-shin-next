"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { Search, LayoutDashboard, Users, ShoppingCart, Receipt, Settings, CornerDownLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const COMMANDS = [
  { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "customers", label: "Go to Customers", icon: Users, href: "/customers" },
  { id: "orders", label: "Go to Orders", icon: ShoppingCart, href: "/orders" },
  { id: "expenses", label: "Go to Expenses", icon: Receipt, href: "/expenses" },
  { id: "settings", label: "Go to Settings", icon: Settings, href: "/settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function runCommand(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-sm text-t3 transition-all hover:border-line-strong hover:bg-surface-hover hover:text-t1 md:w-auto"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:block">Search anything...</span>
        <kbd className="hidden rounded-lg border border-line bg-panel px-1.5 py-0.5 font-mono text-xs text-t3 sm:block">⌘K</kbd>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[12vh] sm:px-6">
          <div
            className="absolute inset-0 bg-[color:var(--bg-overlay-strong)] backdrop-blur-md"
            onMouseDown={() => setOpen(false)}
          />

          <Command
            className="relative isolate w-full max-w-2xl overflow-hidden rounded-[32px] border border-line-strong bg-modal shadow-[var(--shadow-card-hover)]"
            label="Command palette"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.34),transparent_36%)]" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/70 opacity-60" />

            <div className="relative border-b border-divide p-3 sm:p-4">
              <div className="flex items-center gap-3 rounded-[24px] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-sm)]">
                <Search className="h-4 w-4 shrink-0 text-t3" />
                <Command.Input
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent text-base text-t1 placeholder:text-t3 outline-none"
                />
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-t4">
                    Close
                  </span>
                  <kbd className="rounded-xl border border-line bg-topbar px-2 py-1 font-mono text-[11px] text-t2">
                    ESC
                  </kbd>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-t4">
                  Navigation
                </p>
                <p className="hidden text-xs text-t3 sm:block">Jump between workspace sections</p>
              </div>
            </div>

            <Command.List className="relative max-h-[360px] overflow-y-auto p-3 sm:p-4">
              <Command.Empty className="rounded-[24px] border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-t2">
                No commands found.
              </Command.Empty>

              <Command.Group>
                {COMMANDS.map(({ id, label, icon: Icon, href }) => (
                  <Command.Item
                    key={id}
                    value={label}
                    onSelect={() => runCommand(href)}
                    className={cn(
                      "group flex cursor-pointer items-center gap-3 rounded-[24px] border border-transparent px-3 py-3 text-sm outline-none transition-all",
                      "hover:border-line hover:bg-surface hover:text-t1",
                      "data-[selected=true]:border-accent-border data-[selected=true]:bg-accent-bg data-[selected=true]:text-t1",
                      (pathname === href || pathname.startsWith(`${href}/`)) && "border-line bg-surface text-t1"
                    )}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-topbar text-t2">
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-current">{label}</p>
                      <p className="mt-0.5 text-xs text-t3">
                        {href === "/dashboard" && "Overview, stats, and daily activity"}
                        {href === "/customers" && "Profiles, search, and customer management"}
                        {href === "/orders" && "Order queue, status, and fulfillment"}
                        {href === "/expenses" && "Costs, records, and accounting inputs"}
                        {href === "/settings" && "Workspace preferences and configuration"}
                      </p>
                    </div>

                    {(pathname === href || pathname.startsWith(`${href}/`)) ? (
                      <span className="rounded-full border border-accent-border bg-accent-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                        Current
                      </span>
                    ) : (
                      <div className="hidden items-center gap-1 rounded-full border border-line bg-topbar px-2.5 py-1 text-[11px] text-t3 sm:flex">
                        <CornerDownLeft className="h-3 w-3" />
                        Open
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>,
        document.body
      )}
    </>
  );
}
