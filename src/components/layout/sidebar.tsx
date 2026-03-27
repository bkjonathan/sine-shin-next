"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Receipt,
  Settings,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShopSettings } from "@/types";

interface SidebarProps {
  settings?: ShopSettings | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ settings }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0">
      {/* Glass sidebar surface */}
      <div className="flex flex-col h-full bg-white/[0.05] backdrop-blur-2xl border-r border-white/10">
        {/* Logo / Shop name */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded-lg" />
              ) : (
                <Store className="h-5 w-5 text-[#007AFF]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90 truncate">
                {settings?.shopName ?? "My Shop"}
              </p>
              <p className="text-xs text-white/40">Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#007AFF]/20 text-[#007AFF] border border-[#007AFF]/25 shadow-[0_2px_8px_rgba(0,122,255,0.15)]"
                    : "text-white/60 hover:text-white/90 hover:bg-white/[0.08]"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/25 text-center">Shop Manager v1.0</p>
        </div>
      </div>
    </aside>
  );
}
