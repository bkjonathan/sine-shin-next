"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { ShopSettings } from "@/types";

interface DashboardShellProps {
  children: React.ReactNode;
  settings?: ShopSettings | null;
}

export function DashboardShell({ children, settings }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-page text-t1 transition-colors duration-500">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-float-slow absolute left-[-8rem] top-[8rem] h-72 w-72 rounded-full blur-3xl" style={{ background: "var(--gradient-blob-1)" }} />
        <div className="animate-float-reverse absolute right-[-6rem] top-16 h-80 w-80 rounded-full blur-3xl" style={{ background: "var(--gradient-blob-2)" }} />
        <div className="animate-pulse-glow absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full blur-3xl" style={{ background: "var(--accent-bg)" }} />
      </div>

      <Sidebar
        settings={settings}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <div className="relative flex min-h-screen flex-col overflow-x-hidden lg:ml-[19rem]">
        <Topbar settings={settings} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1480px] animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
