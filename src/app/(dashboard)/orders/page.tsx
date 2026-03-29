"use client";

import { useState } from "react";
import { useOrders, useCreateOrder } from "@/hooks/use-orders";
import { OrderTable } from "@/components/orders/order-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { OrderForm } from "@/components/orders/order-form";
import { Plus, Download, Upload, Printer, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react";
import type { CreateOrderInput } from "@/validations/order.schema";
import { ORDER_STATUSES } from "@/validations/order.schema";
import { cn } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";

type SortOrder = "asc" | "desc";

const SEARCH_FIELD_OPTIONS = [
  { value: "customerName", label: "Customer Name" },
  { value: "orderId", label: "Order ID" },
];

const SORT_OPTIONS = [
  { value: "createdAt", label: "Sort by ID" },
  { value: "orderId", label: "Sort by Order No." },
  { value: "status", label: "Sort by Status" },
];

const PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const STATUS_PILLS = ["all", ...ORDER_STATUSES] as const;

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("customerName");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<"table" | "grid">("table");
  const [creating, setCreating] = useState(false);
  const createOrder = useCreateOrder();
  const { prefs } = useCurrencyPrefs();

  const { data, isLoading } = useOrders({ page, search, searchField, status, limit, sort, order });

  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const pageOffset = (page - 1) * limit;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleSort = (val: string) => { setSort(val); setPage(1); };
  const handleLimit = (val: string) => { setLimit(Number(val)); setPage(1); };
  const handleStatus = (val: string) => { setStatus(val === "all" ? "" : val); setPage(1); };

  const handleExportCSV = () => {
    const rows = data?.data ?? [];
    const header = ["Order ID", "Customer", "Status", "Date", "Total"];
    const body = rows.map((o) => [
      o.orderId,
      o.customerName ?? "",
      o.status,
      new Date(o.createdAt).toLocaleDateString(),
      String((o.shippingFee ?? 0) + (o.deliveryFee ?? 0) + (o.cargoFee ?? 0) + (o.serviceFee ?? 0)),
    ]);
    const csv = [header, ...body].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  })();

  const activeStatus = status || "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage your orders and shipments"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="secondary" size="sm">
              <Upload className="h-4 w-4" /> Import CSV
            </GlassButton>
            <GlassButton variant="secondary" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </GlassButton>
            <GlassButton variant="secondary" size="sm">
              <Printer className="h-4 w-4" /> Label Print
            </GlassButton>
            <GlassButton onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add Order
            </GlassButton>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <GlassSelect
            value={searchField}
            onValueChange={(v) => { setSearchField(v); setPage(1); }}
            options={SEARCH_FIELD_OPTIONS}
          />
        </div>
        <div className="flex-1 min-w-48 relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-t3">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <GlassInput
            placeholder="Search orders, customers..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-44">
            <GlassSelect value={sort} onValueChange={handleSort} options={SORT_OPTIONS} />
          </div>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setOrder(o => o === "asc" ? "desc" : "asc")}
            aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          >
            {order === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </GlassButton>
          <GlassButton
            variant={view === "grid" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </GlassButton>
          <GlassButton
            variant={view === "table" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setView("table")}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_PILLS.map((s) => (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              activeStatus === s
                ? "bg-accent text-white shadow-[0_4px_14px_var(--accent-shadow)]"
                : "border border-line bg-surface text-t2 hover:bg-surface-hover hover:text-t1"
            )}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {view === "table" ? (
        <OrderTable orders={data?.data ?? []} isLoading={isLoading} pageOffset={pageOffset} />
      ) : (
        <OrderGrid orders={data?.data ?? []} isLoading={isLoading} />
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-3.5">
        <span className="text-sm text-t2">{total} orders</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-t2">
            Per page
            <div className="w-20">
              <GlassSelect value={String(limit)} onValueChange={handleLimit} options={PER_PAGE_OPTIONS} />
            </div>
          </div>
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </GlassButton>
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-1 text-sm text-t3">...</span>
              ) : (
                <GlassButton
                  key={p}
                  variant={p === page ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPage(p as number)}
                  className="min-w-[2.25rem]"
                >
                  {p}
                </GlassButton>
              )
            )}
          </div>
          <span className="text-sm text-t2">Page {page} of {totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </GlassButton>
        </div>
      </div>

      <GlassModal open={creating} onOpenChange={setCreating} title="New Order" size="lg">
        <OrderForm
          onSubmit={(d: CreateOrderInput) => createOrder.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createOrder.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}

type OrderRow = {
  id: string;
  orderId: string;
  status: string;
  shippingFee: number;
  deliveryFee: number;
  cargoFee: number;
  serviceFee: number;
  createdAt: Date | string;
  customerName?: string | null;
  totalQty?: number | null;
  totalWeight?: number | null;
};

function OrderGrid({ orders, isLoading }: { orders: OrderRow[]; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface h-32" />
        ))}
      </div>
    );
  }
  if (!orders.length) {
    return <p className="py-12 text-center text-sm text-t3">No orders found</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((o) => {
        const total = (o.shippingFee ?? 0) + (o.deliveryFee ?? 0) + (o.cargoFee ?? 0) + (o.serviceFee ?? 0);
        return (
          <div key={o.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-lg border border-line bg-surface-hover px-2.5 py-1 font-mono text-xs text-t2">
                {o.orderId}
              </span>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                o.status === "completed" ? "bg-green-500/15 text-green-400" :
                o.status === "processing" ? "bg-yellow-500/15 text-yellow-400" :
                o.status === "arrived" ? "bg-blue-500/15 text-blue-400" :
                "bg-surface-hover text-t2"
              )}>
                {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
              </span>
            </div>
            {o.customerName && (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                  {o.customerName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-t1">{o.customerName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-t3">
              <span>{prefs.currencySymbol} {total.toLocaleString()}</span>
              <span>{new Date(o.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
