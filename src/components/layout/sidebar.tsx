"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Receipt,
  Settings,
  Store,
  X,
  Sparkles,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShopSettings } from "@/types";

interface SidebarProps {
  settings?: ShopSettings | null;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/users", label: "Users", icon: UserCog, ownerOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function BrandBlock({
  settings,
  compact = false,
}: {
  settings?: ShopSettings | null;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2.5")}>
      <div className={cn(
        "flex items-center justify-center rounded-2xl border border-accent-border bg-accent-bg shadow-[0_14px_30px_var(--accent-shadow)]",
        compact ? "h-11 w-11" : "h-13 w-13"
      )}>
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className={cn("rounded-xl object-contain", compact ? "h-7 w-7" : "h-8 w-8")}
          />
        ) : (
          <Store className={cn("text-accent", compact ? "h-5 w-5" : "h-6 w-6")} />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-t1">
          {settings?.shopName ?? "My Shop"}
        </p>
        <p className="text-xs text-t3">Operations workspace</p>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact = false,
  onClick,
}: {
  href: string;
  label: string;
  icon: (typeof navItems)[number]["icon"];
  active: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border text-sm font-medium transition-all duration-300",
        compact ? "flex-col gap-1.5 px-2 py-2.5 text-[11px]" : "px-3.5 py-3",
        active
          ? "border-accent-border bg-accent-bg text-accent shadow-[0_14px_30px_var(--accent-shadow)]"
          : "border-transparent text-t2 hover:border-line hover:bg-surface hover:text-t1"
      )}
    >
      <span className={cn(
        "absolute inset-y-0 left-0 w-1 rounded-r-full bg-accent transition-opacity",
        active ? "opacity-100" : "opacity-0"
      )} />
      <Icon className={cn("shrink-0", compact ? "h-4 w-4" : "h-4.5 w-4.5")} />
      <span className={cn("truncate", compact && "max-w-[4.5rem]")}>{label}</span>
    </Link>
  );
}

export function Sidebar({
  settings,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const closeMobile = () => onMobileOpenChange?.(false);

  const filteredNavItems = navItems.filter(
    (item) => !("ownerOnly" in item && item.ownerOnly) || userRole === "owner"
  );

  useEffect(() => {
    onMobileOpenChange?.(false);
  }, [pathname, onMobileOpenChange]);

  return (
    <>
      <aside className="fixed inset-y-4 left-4 z-30 hidden w-72 lg:flex">
        <div className="flex h-full w-full flex-col rounded-[32px] border border-line bg-sidebar p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl">
          <div className="rounded-[28px] border border-line bg-surface p-4">
            <BrandBlock settings={settings} />
            <div className="mt-4 rounded-2xl border border-line bg-panel px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-t2">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Live workspace
              </div>
              <p className="mt-1 text-xs leading-5 text-t3">
                Orders, customers, and expenses in one responsive dashboard.
              </p>
            </div>
          </div>

          <nav className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-[28px] border border-line bg-surface p-3">
            {filteredNavItems.map(({ href, label, icon }) => {
              const isActive =
                pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={isActive}
                />
              );
            })}
          </nav>

          <div className="mt-4 rounded-[28px] border border-line bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-t4">
              Studio
            </p>
            <p className="mt-2 text-sm font-medium text-t1">Mobile-first shell</p>
            <p className="mt-1 text-xs leading-5 text-t3">
              Quick navigation lives in the bottom dock, while the full workspace stays in the drawer.
            </p>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className={cn(
            "absolute inset-0 bg-[color:var(--bg-overlay)] backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />

        <aside
          className={cn(
            "absolute inset-y-3 left-3 w-[86vw] max-w-sm rounded-[30px] border border-line bg-sidebar p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-[108%]"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <BrandBlock settings={settings} compact />
            <button
              type="button"
              onClick={closeMobile}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-t2 transition hover:bg-surface-hover hover:text-t1"
              aria-label="Close navigation"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <nav className="mt-6 space-y-2">
            {filteredNavItems.map(({ href, label, icon }) => {
              const isActive =
                pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  active={isActive}
                  onClick={closeMobile}
                />
              );
            })}
          </nav>
        </aside>
      </div>

      <nav className="mobile-safe-bottom fixed inset-x-3 bottom-3 z-30 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1 rounded-[24px] border border-line bg-sidebar px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
          {filteredNavItems.map(({ href, label, icon }) => {
            const isActive =
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={isActive}
                compact
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}
