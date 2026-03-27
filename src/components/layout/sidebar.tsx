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
      <div className="flex flex-col h-full bg-sidebar backdrop-blur-2xl border-r border-line">
        {/* Logo / Shop name */}
        <div className="p-6 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded-lg" />
              ) : (
                <Store className="h-5 w-5 text-accent" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-t1 truncate">
                {settings?.shopName ?? "My Shop"}
              </p>
              <p className="text-xs text-t3">Management</p>
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
                    ? "bg-accent-bg text-accent border border-accent-border [box-shadow:0_2px_8px_var(--accent-shadow)]"
                    : "text-t2 hover:text-t1 hover:bg-surface"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-line">
          <p className="text-xs text-t4 text-center">Shop Manager v1.0</p>
        </div>
      </div>
    </aside>
  );
}
