"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Menu, CalendarDays } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeSelector } from "@/components/ui/theme-selector";
import type { ShopSettings } from "@/types";

interface TopbarProps {
  settings?: ShopSettings | null;
  onMenuClick?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/orders": "Orders",
  "/expenses": "Expenses",
  "/account": "Account Book",
  "/settings": "Settings",
};

export function Topbar({ settings, onMenuClick }: TopbarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const section =
    Object.entries(SECTION_LABELS).find(([prefix]) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
    )?.[1] ?? "Workspace";
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-line bg-topbar px-3 py-3 shadow-[var(--shadow-sm)] backdrop-blur-2xl sm:px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface text-t2 transition hover:bg-surface-hover hover:text-t1 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-t4">
              {settings?.shopName ?? "Shop Manager"}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-t1">
                {section}
              </h1>
              <span className="hidden items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-t3 md:inline-flex">
                <CalendarDays className="h-3.5 w-3.5 text-accent" />
                {todayLabel}
              </span>
            </div>
          </div>

          <div className="hidden md:block">
            <CommandPalette />
          </div>

          <ThemeSelector />

          <div className="hidden items-center gap-3 rounded-full border border-line bg-surface px-2 py-1.5 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-border bg-accent-bg">
              <User className="h-4 w-4 text-accent" />
            </div>
            <div className="hidden pr-1 md:block">
              <p className="text-sm font-medium text-t1">
                {session?.user?.name ?? "User"}
              </p>
              <p className="text-xs text-t3">Signed in</p>
            </div>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </GlassButton>
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            className="sm:hidden"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </GlassButton>
        </div>

        <div className="mt-3 md:hidden">
          <CommandPalette />
        </div>
      </div>
    </header>
  );
}
