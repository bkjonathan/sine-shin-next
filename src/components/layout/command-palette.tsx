"use client";

import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { Search, LayoutDashboard, Users, ShoppingCart, Receipt, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
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

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
          <div
            className="absolute inset-0 bg-[color:var(--bg-overlay)] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <Command
            className="relative w-[calc(100vw-1.5rem)] max-w-xl overflow-hidden rounded-[28px] border border-line bg-panel shadow-[var(--shadow-card-hover)] backdrop-blur-3xl"
            label="Command palette"
          >
            <div className="flex items-center gap-3 border-b border-divide px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-t3" />
              <Command.Input
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-t1 placeholder:text-t4 outline-none"
              />
              <kbd className="rounded-lg border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-t3">ESC</kbd>
            </div>

            <Command.List className="p-2 max-h-72 overflow-y-auto">
              <Command.Empty className="py-8 text-center text-sm text-t3">
                No commands found
              </Command.Empty>

              <Command.Group heading={<span className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-t4">Navigation</span>}>
                {COMMANDS.map(({ id, label, icon: Icon, href }) => (
                  <Command.Item
                    key={id}
                    value={label}
                    onSelect={() => runCommand(href)}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-t2 outline-none transition-colors data-[selected=true]:bg-surface-hover data-[selected=true]:text-t1"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
