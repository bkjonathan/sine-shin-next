"use client";

import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { Search, LayoutDashboard, Users, ShoppingCart, Receipt, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

const COMMANDS = [
  { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, href: "/" },
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/40 bg-white/[0.06] border border-white/10 hover:border-white/20 hover:text-white/60 transition-all"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:block">Search...</span>
        <kbd className="hidden sm:block text-xs px-1.5 py-0.5 rounded bg-white/10 font-mono">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <Command
            className="relative w-full max-w-lg rounded-2xl bg-[rgba(15,15,20,0.95)] backdrop-blur-3xl border border-white/15 shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden"
            label="Command palette"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search className="h-4 w-4 text-white/40 shrink-0" />
              <Command.Input
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none"
              />
              <kbd className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/40 font-mono">ESC</kbd>
            </div>

            <Command.List className="p-2 max-h-72 overflow-y-auto">
              <Command.Empty className="py-8 text-center text-sm text-white/40">
                No commands found
              </Command.Empty>

              <Command.Group heading={<span className="px-2 py-1 text-xs font-semibold text-white/30 uppercase tracking-wider">Navigation</span>}>
                {COMMANDS.map(({ id, label, icon: Icon, href }) => (
                  <Command.Item
                    key={id}
                    value={label}
                    onSelect={() => runCommand(href)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 cursor-pointer data-[selected=true]:bg-white/10 data-[selected=true]:text-white outline-none transition-colors"
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
