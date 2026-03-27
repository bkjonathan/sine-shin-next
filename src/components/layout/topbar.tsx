"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Bell } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { CommandPalette } from "@/components/layout/command-palette";

interface TopbarProps {
  title?: string;
}

export function Topbar({ title }: TopbarProps) {
  const { data: session } = useSession();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white/[0.04] backdrop-blur-2xl border-b border-white/10 sticky top-0 z-30">
      {/* Left: Page title */}
      <h1 className="text-base font-semibold text-white/80">{title}</h1>

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        <CommandPalette />

        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center">
            <User className="h-4 w-4 text-[#007AFF]" />
          </div>
          <span className="text-sm text-white/70 hidden sm:block">
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
