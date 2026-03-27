"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Bell } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CommandPalette } from "@/components/layout/command-palette";
import { ThemeSelector } from "@/components/ui/theme-selector";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-topbar backdrop-blur-2xl border-b border-line sticky top-0 z-30">
      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <CommandPalette />

        <ThemeSelector />

        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center text-t2 hover:text-t1 hover:bg-surface transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-line">
          <div className="w-8 h-8 rounded-full bg-accent-bg border border-accent-border flex items-center justify-center">
            <User className="h-4 w-4 text-accent" />
          </div>
          <span className="text-sm text-t2 hidden sm:block">
            {session?.user?.name ?? "User"}
          </span>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>
    </header>
  );
}
