"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { ShopSettings } from "@/types";
import { InvoicePrintLayout } from "@/components/invoice/InvoicePrintLayout";
import { InvoiceDownloadTemplate } from "@/components/invoice/InvoiceDownloadTemplate";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassBadge } from "@/components/ui/glass-badge";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderItemsSection } from "@/components/orders/order-items-section";
import { OrderDetailActions } from "@/components/orders/order-detail-actions";
import { CustomerCombobox } from "@/components/orders/customer-combobox";
import { PageHeader } from "@/components/layout/page-header";
import { useUpdateOrder } from "@/hooks/use-orders";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { ORDER_STATUSES, ORDER_FROM_OPTIONS } from "@/validations/order.schema";
import type { Order, OrderItem } from "@/types";
import {
  ArrowLeft,
  Calendar,
  Truck,
  Package,
  User,
  Globe,
  ArrowRightLeft,
  ShoppingBag,
  CreditCard,
  CircleDollarSign,
  Weight,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Circle,
  Truck as TruckIcon,
  XCircle,
  Pencil,
  Check,
  X,
  Printer,
  Download,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomerInfo {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  city: string | null;
  platform: string | null;
  address: string | null;
}

interface OrderDetailClientProps {
  order: Order;
  items: OrderItem[];
  customer: CustomerInfo | null;
  shop: ShopSettings | null;
}

// ── Inline Edit Primitives ───────────────────────────────────────────────────

function InlineText({
  value,
  displayValue,
  onSave,
  type = "text",
  step,
  min,
  className,
}: {
  value: string | number;
  displayValue?: ReactNode;
  onSave: (v: string) => void;
  type?: "text" | "number" | "date";
  step?: string;
  min?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(String(value));
      // Small delay to let the input render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, value]);

  function commit() {
    if (draft !== String(value)) {
      onSave(draft);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={step}
        min={min}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        onBlur={commit}
        className={cn(
          "rounded-xl border border-accent-border bg-field px-2 py-1 text-sm text-t1 outline-none",
          "ring-2 ring-accent-bg/60 transition-all",
          type === "number" && "w-24 text-right font-mono",
          type === "date" && "w-36",
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group/inline relative inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -mx-1.5 transition-all",
        "hover:bg-accent-bg/40 cursor-pointer",
        className
      )}
    >
      <span>{displayValue ?? String(value)}</span>
      <Pencil className="h-2.5 w-2.5 text-t4 opacity-0 transition-opacity group-hover/inline:opacity-100" />
    </button>
  );
}

function InlineToggle({
  checked,
  onToggle,
  label,
  variant = "default",
}: {
  checked: boolean | null | undefined;
  onToggle: (v: boolean) => void;
  label: string;
  variant?: "success" | "warning" | "neutral" | "default";
}) {
  const colorMap = {
    success: {
      on: "border-[rgba(49,201,126,0.25)] bg-[rgba(49,201,126,0.1)] text-success",
      off: "border-line bg-surface-hover text-t4 hover:border-line-strong",
    },
    warning: {
      on: "border-[rgba(255,176,32,0.25)] bg-[rgba(255,176,32,0.1)] text-warning",
      off: "border-line bg-surface-hover text-t4 hover:border-line-strong",
    },
    neutral: {
      on: "border-line bg-surface-hover text-t2",
      off: "border-line bg-surface-hover text-t4 hover:border-line-strong",
    },
    default: {
      on: "border-accent-border bg-accent-bg text-accent",
      off: "border-line bg-surface-hover text-t4 hover:border-line-strong",
    },
  };
  const colors = colorMap[variant];
  const isOn = !!checked;

  return (
    <button
      type="button"
      onClick={() => onToggle(!isOn)}
      className={cn(
        "rounded-full border px-1.5 py-px text-[10px] font-medium transition-all cursor-pointer",
        isOn ? colors.on : colors.off
      )}
    >
      {label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function OrderDetailClient({ order: initialOrder, items: initialItems, customer: initialCustomer, shop }: OrderDetailClientProps) {
  const router = useRouter();
  const updateOrder = useUpdateOrder();
  const { prefs } = useCurrencyPrefs();
  const downloadRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Local optimistic state
  const [order, setOrder] = useState(initialOrder);
  const [customer, setCustomer] = useState(initialCustomer);

  // Sync when server data changes (e.g. after router.refresh)
  useEffect(() => { setOrder(initialOrder); }, [initialOrder]);
  useEffect(() => { setCustomer(initialCustomer); }, [initialCustomer]);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      // Optimistic update
      setOrder((prev) => ({ ...prev, ...patch } as Order));
      updateOrder.mutate(
        { id: order.id, ...patch },
        {
          onSuccess: () => {
            router.refresh();
          },
          onError: () => {
            // Revert on error
            setOrder(initialOrder);
          },
        }
      );
    },
    [order.id, initialOrder, updateOrder, router]
  );

  // ── Financial calculations ──────────────────────────────────────────
  const items = initialItems; // items are managed by OrderItemsSection
  const itemsSubtotal = items.reduce((s, i) => s + (i.price ?? 0) * (i.productQty ?? 0), 0);
  const totalQty = items.reduce((s, i) => s + (i.productQty ?? 0), 0);
  const totalWeight = items.reduce((s, i) => s + (i.productWeight ?? 0), 0);
  const discount = order.productDiscount ?? 0;

  const shippingFee = order.shippingFee;
  const deliveryFee = order.deliveryFee;
  const cargoFee = order.cargoFee;
  const serviceFeeRate = order.serviceFee;
  // Service fee % applies to itemsSubtotal (primary currency), not the exchange-converted amount
  const isPercentFee = order.serviceFeeType === "%" || order.serviceFeeType === "percent";
  const serviceFeeAmount = isPercentFee ? itemsSubtotal * (serviceFeeRate / 100) : serviceFeeRate;
  const feesTotal = shippingFee + deliveryFee + cargoFee + serviceFeeAmount;

  const shopAbsorbedFees =
    (order.shippingFeeByShop ? shippingFee : 0) +
    (order.deliveryFeeByShop ? deliveryFee : 0) +
    (order.cargoFeeByShop ? cargoFee : 0);

  const customerFees = feesTotal - shopAbsorbedFees;
  // grandTotal stays in primary currency ($); exchange rate is applied only at display time
  const grandTotal = itemsSubtotal - discount + customerFees;
  const grandTotalInExchangeCurrency = grandTotal * order.exchangeRate;

  // ── Status timeline ─────────────────────────────────────────────────
  const statusSteps = [
    { key: "pending", label: "Pending", icon: Clock, date: order.orderDate },
    { key: "ordered", label: "Ordered", icon: ShoppingBag, date: order.shipmentDate },
    { key: "arrived", label: "Arrived", icon: PackageCheck, date: order.arrivedDate },
    { key: "shipping", label: "Shipping", icon: TruckIcon, date: order.shipmentDate },
    { key: "completed", label: "Completed", icon: CheckCircle2, date: order.userWithdrawDate },
  ];
  const isCancelled = order.status === "cancelled";
  const statusIndex = isCancelled ? -1 : statusSteps.findIndex((s) => s.key === order.status);

  // ── Fee detail rows ─────────────────────────────────────────────────
  const feeRows = [
    { key: "shipping" as const, label: "Shipping Fee", field: "shippingFee" as const, amount: shippingFee, paid: order.shippingFeePaid, paidField: "shippingFeePaid" as const, byShop: order.shippingFeeByShop, byShopField: "shippingFeeByShop" as const },
    { key: "delivery" as const, label: "Delivery Fee", field: "deliveryFee" as const, amount: deliveryFee, paid: order.deliveryFeePaid, paidField: "deliveryFeePaid" as const, byShop: order.deliveryFeeByShop, byShopField: "deliveryFeeByShop" as const },
    { key: "cargo" as const, label: "Cargo Fee", field: "cargoFee" as const, amount: cargoFee, paid: order.cargoFeePaid, paidField: "cargoFeePaid" as const, byShop: order.cargoFeeByShop, byShopField: "cargoFeeByShop" as const, excluded: order.excludeCargoFee },
    { key: "service" as const, label: "Service Fee", field: "serviceFee" as const, amount: serviceFeeRate, computedAmount: serviceFeeAmount, paid: order.serviceFeePaid, paidField: "serviceFeePaid" as const, byShop: null, byShopField: null, type: order.serviceFeeType },
  ];

  const statusOptions = ORDER_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
  const sourceOptions = ORDER_FROM_OPTIONS.map((s) => ({ value: s, label: s }));

  // ── Invoice values (all fees shown, no shop-absorbed deduction) ──────
  const invoiceOrderTotal = itemsSubtotal + feesTotal;
  const invoiceTotalWithExchange = invoiceOrderTotal * order.exchangeRate;

  // ── Invoice actions ──────────────────────────────────────────────────
  async function handleDownload() {
    const el = downloadRef.current;
    if (!el) return;
    setIsDownloading(true);
    try {
      // Temporarily bring the element on-screen so the browser computes layout
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.zIndex = "-9999";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";

      // Wait for layout recalculation + images
      await document.fonts.ready;
      const images = el.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })
        )
      );
      await new Promise((r) => setTimeout(r, 300));

      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        skipFonts: true,
        width: 920,
        height: el.scrollHeight || 1200,
        style: {
          position: "static",
          left: "auto",
          top: "auto",
          opacity: "1",
        },
      });
      const link = document.createElement("a");
      link.download = `invoice_${order.orderId}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      // Restore off-screen positioning
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "-9999px";
      el.style.zIndex = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
      setIsDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-t3 transition-all hover:-translate-y-0.5 hover:text-t1 hover:border-line-strong hover:[box-shadow:var(--shadow-card)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={order.orderId}
          description={`Created ${formatDate(order.createdAt)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <OrderStatusBadge status={order.status} />
              <GlassButton variant="ghost" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                <span className="text-xs">Print</span>
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={handleDownload} loading={isDownloading}>
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Download</span>
              </GlassButton>
              <OrderDetailActions orderId={order.id} />
            </div>
          }
          className="mb-0 flex-1"
        />
      </div>

      {/* ── Status Timeline (clickable) ─────────────────────────────────── */}
      <GlassCard className="overflow-x-auto">
        <div className="flex items-center justify-between min-w-[540px]">
          {statusSteps.map((step, i) => {
            const isCompleted = !isCancelled && i <= statusIndex;
            const isCurrent = !isCancelled && i === statusIndex;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => save({ status: step.key })}
                    title={`Set status to ${step.label}`}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all cursor-pointer",
                      isCurrent
                        ? "border-accent bg-accent-bg text-accent scale-110"
                        : isCompleted
                          ? "border-success bg-[rgba(49,201,126,0.14)] text-success"
                          : "border-line bg-surface text-t4 hover:border-line-strong hover:text-t3"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </button>
                  <span className={cn("text-xs font-medium", isCurrent ? "text-accent" : isCompleted ? "text-success" : "text-t4")}>
                    {step.label}
                  </span>
                  {step.date && (
                    <span className="text-[10px] text-t4">{formatDate(step.date, "MMM d")}</span>
                  )}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={cn("mx-2 h-0.5 flex-1 rounded-full transition-colors", !isCancelled && i < statusIndex ? "bg-success" : "bg-line")} />
                )}
              </div>
            );
          })}
          {/* Cancelled — separator + button */}
          <div className="mx-2 h-0.5 flex-1 rounded-full bg-line" />
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => save({ status: "cancelled" })}
              title="Set status to Cancelled"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all cursor-pointer",
                isCancelled
                  ? "border-danger bg-[rgba(255,80,80,0.14)] text-danger scale-110"
                  : "border-line bg-surface text-t4 hover:border-line-strong hover:text-t3"
              )}
            >
              <XCircle className="h-4.5 w-4.5" />
            </button>
            <span className={cn("text-xs font-medium", isCancelled ? "text-danger" : "text-t4")}>
              Cancelled
            </span>
          </div>
        </div>
      </GlassCard>

      {/* ── Financial Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(50,184,255,0.12)] text-info">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Items</p>
              <p className="text-lg font-bold text-t1">{formatCurrency(itemsSubtotal, prefs.currencySymbol)}</p>
              <p className="text-[10px] text-t4">{totalQty} item{totalQty !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(255,176,32,0.12)] text-warning">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Fees</p>
              <p className="text-lg font-bold text-t1">{formatCurrency(feesTotal, prefs.currencySymbol)}</p>
              <p className="text-[10px] text-t4">{shopAbsorbedFees > 0 ? `${formatCurrency(shopAbsorbedFees, prefs.currencySymbol)} by shop` : "All charged"}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(49,201,126,0.12)] text-success">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Grand Total</p>
              <p className="text-lg font-bold text-t1">{formatCurrency(grandTotal, prefs.currencySymbol)}</p>
              {discount > 0 && <p className="text-[10px] text-danger">-{formatCurrency(discount, prefs.currencySymbol)} disc.</p>}
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm" hover>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(175,130,255,0.12)] text-[rgb(175,130,255)]">
              <Weight className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-t4">Weight</p>
              <p className="text-lg font-bold text-t1">{totalWeight.toFixed(2)} kg</p>
              <p className="text-[10px] text-t4">{items.length} product{items.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Main Content (left 2/3) ──────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items */}
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-t3">Order Items</h3>
              <span className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-t3">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <OrderItemsSection orderId={order.id} items={items} />
          </GlassCard>

          {/* Financial Breakdown — inline editable fees */}
          <GlassCard>
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Financial Breakdown</h3>

            {/* Items subtotal */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-t3">Items Subtotal ({totalQty} × avg)</span>
                <span className="font-medium text-t1">{formatCurrency(itemsSubtotal, prefs.currencySymbol)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-t3 flex items-center gap-1.5">
                  Product Discount
                  {discount > 0 && <span className="text-danger">(-)</span>}
                </span>
                <InlineText
                  value={discount}
                  displayValue={<span className={cn("font-medium", discount > 0 ? "text-danger" : "text-t1")}>{discount > 0 ? `-${formatCurrency(discount, prefs.currencySymbol)}` : formatCurrency(0, prefs.currencySymbol)}</span>}
                  type="number"
                  step="0.01"
                  min="0"
                  onSave={(v) => save({ productDiscount: parseFloat(v) || 0 })}
                />
              </div>
            </div>

            <div className="my-4 border-t border-divide" />

            {/* Fees — each amount is inline editable, toggles for paid/shop */}
            <div className="space-y-3">
              {feeRows.map((fee) => (
                <div key={fee.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-t3">{fee.label}</span>
                    <div className="flex gap-1">
                      <InlineToggle
                        checked={fee.paid}
                        onToggle={(v) => save({ [fee.paidField]: v })}
                        label="Paid"
                        variant="success"
                      />
                      {fee.byShopField && (
                        <InlineToggle
                          checked={fee.byShop}
                          onToggle={(v) => save({ [fee.byShopField!]: v })}
                          label="Shop"
                          variant="warning"
                        />
                      )}
                      {fee.key === "cargo" && (
                        <InlineToggle
                          checked={fee.excluded}
                          onToggle={(v) => save({ excludeCargoFee: v })}
                          label="Excluded"
                          variant="neutral"
                        />
                      )}
                      {fee.type && (
                        <InlineToggle
                          checked={fee.type === "%" || fee.type === "percent"}
                          onToggle={(v) => save({ serviceFeeType: v ? "percent" : "fixed" })}
                          label={fee.type === "%" || fee.type === "percent" ? "%" : prefs.currencySymbol}
                          variant="neutral"
                        />
                      )}
                    </div>
                  </div>
                  <InlineText
                    value={fee.amount}
                    displayValue={
                      <span className={cn("font-medium", fee.byShop ? "text-t4 line-through" : "text-t1")}>
                        {fee.computedAmount !== undefined && fee.type === "%" ? (
                          <>{formatCurrency(fee.computedAmount, prefs.currencySymbol)} <span className="text-xs text-t3">({fee.amount}%)</span></>
                        ) : (
                          formatCurrency(fee.amount, prefs.currencySymbol)
                        )}
                      </span>
                    }
                    type="number"
                    step="0.01"
                    min="0"
                    onSave={(v) => save({ [fee.field]: parseFloat(v) || 0 })}
                  />
                </div>
              ))}
            </div>

            <div className="my-4 border-t border-divide" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-t3">Subtotal (items + fees)</span>
                <span className="font-medium text-t1">{formatCurrency(itemsSubtotal - discount + feesTotal, prefs.currencySymbol)}</span>
              </div>
              {shopAbsorbedFees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-warning">Shop Absorbed Fees</span>
                  <span className="font-medium text-warning">-{formatCurrency(shopAbsorbedFees, prefs.currencySymbol)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-accent-border bg-accent-bg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-t1">Total</span>
                  <span className="text-xl font-bold text-accent">{formatCurrency(grandTotal, prefs.currencySymbol)}</span>
                </div>
              </div>
              {serviceFeeAmount > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-t2">Profit</span>
                  <span className="text-lg font-bold text-success">{formatCurrency(serviceFeeAmount, prefs.currencySymbol)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-t2">Total × Exchange Rate</span>
                <span className="text-lg font-bold text-accent">{prefs.exchangeCurrencySymbol} {grandTotalInExchangeCurrency.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* ── Sidebar (right 1/3) ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Customer — inline editable */}
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Customer</h3>
            {customer ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg text-accent">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-t1 transition-colors hover:text-accent">
                      {customer.name}
                    </Link>
                    <p className="font-mono text-xs text-t3">{customer.customerId}</p>
                  </div>
                </div>
                {(customer.phone || customer.city || customer.address) && (
                  <div className="space-y-1.5 border-t border-divide pt-3">
                    {customer.phone && <p className="text-xs text-t2">{customer.phone}</p>}
                    {customer.city && <p className="text-xs text-t3">{customer.city}</p>}
                    {customer.address && <p className="text-xs text-t3">{customer.address}</p>}
                  </div>
                )}
                <div className="border-t border-divide pt-3">
                  <CustomerCombobox
                    value={order.customerId ?? ""}
                    onValueChange={(v) => {
                      save({ customerId: v || null });
                    }}
                    placeholder="Change customer..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-t4">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-t3">No customer linked</p>
                </div>
                <CustomerCombobox
                  value=""
                  onValueChange={(v) => {
                    save({ customerId: v || null });
                  }}
                  placeholder="Link a customer..."
                />
              </div>
            )}
          </GlassCard>

          {/* Order Details — inline editable */}
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Order Details</h3>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Source</dt>
                  <dd>
                    <GlassSelect
                      options={sourceOptions}
                      value={order.orderFrom ?? ""}
                      onValueChange={(v) => save({ orderFrom: v })}
                      className="!rounded-xl !py-1.5 !px-2.5 !text-sm !border-transparent hover:!border-line"
                    />
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-hover text-t3">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                <div>
                  <dt className="text-[10px] font-medium uppercase tracking-wider text-t4">Exchange Rate</dt>
                  <dd>
                    <InlineText
                      value={order.exchangeRate}
                      displayValue={<span className="font-mono text-sm text-t1">{order.exchangeRate.toFixed(4)}</span>}
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      onSave={(v) => save({ exchangeRate: parseFloat(v) || order.exchangeRate })}
                    />
                  </dd>
                </div>
              </div>
            </dl>
          </GlassCard>

          {/* Timeline — inline editable dates */}
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Timeline</h3>
            <div className="relative space-y-4 pl-6">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-line" />

              {([
                { label: "Order Date", field: "orderDate" as const, date: order.orderDate },
                { label: "Shipment Date", field: "shipmentDate" as const, date: order.shipmentDate },
                { label: "Arrived Date", field: "arrivedDate" as const, date: order.arrivedDate },
                { label: "Withdraw Date", field: "userWithdrawDate" as const, date: order.userWithdrawDate },
              ]).map((entry) => (
                <div key={entry.label} className="relative flex items-center gap-3">
                  <div className={cn(
                    "absolute -left-6 flex h-[15px] w-[15px] items-center justify-center rounded-full border-2",
                    entry.date ? "border-accent bg-accent-bg" : "border-line bg-surface"
                  )}>
                    <Circle className={cn("h-1.5 w-1.5", entry.date ? "fill-accent text-accent" : "fill-line text-line")} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-t4">{entry.label}</p>
                    <InlineText
                      value={entry.date ?? ""}
                      displayValue={
                        <span className={cn("text-sm", entry.date ? "text-t1" : "text-t4")}>
                          {entry.date ? formatDate(entry.date) : "—"}
                        </span>
                      }
                      type="date"
                      onSave={(v) => save({ [entry.field]: v || null })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Payment Status — clickable toggles */}
          <GlassCard>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-t3">Payment Status</h3>
            <div className="space-y-2.5">
              {feeRows.map((fee) => (
                <div key={fee.key} className="flex items-center justify-between">
                  <span className="text-xs text-t3">{fee.label}</span>
                  <div className="flex items-center gap-1.5">
                    {fee.amount > 0 ? (
                      <button
                        type="button"
                        onClick={() => save({ [fee.paidField]: !fee.paid })}
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all cursor-pointer",
                          fee.paid
                            ? "bg-[rgba(49,201,126,0.1)] text-success hover:bg-[rgba(49,201,126,0.2)]"
                            : "bg-[rgba(255,176,32,0.1)] text-warning hover:bg-[rgba(255,176,32,0.2)]"
                        )}
                      >
                        {fee.paid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {fee.paid ? "Paid" : "Unpaid"}
                      </button>
                    ) : (
                      <span className="text-xs text-t4">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Saving indicator */}
      {updateOrder.isPending && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-sm text-t2">Saving...</span>
        </div>
      )}

      {/* ── Hidden invoice templates (off-screen, captured by html-to-image / print) ── */}
      <InvoicePrintLayout
        ref={printRef}
        shop={shop}
        order={order}
        customer={customer}
        items={items}
        itemsSubtotal={itemsSubtotal}
        serviceFeeAmount={serviceFeeAmount}
        orderTotal={invoiceOrderTotal}
        totalWithExchange={invoiceTotalWithExchange}
      />
      <InvoiceDownloadTemplate
        ref={downloadRef}
        shop={shop}
        order={order}
        customer={customer}
        items={items}
        itemsSubtotal={itemsSubtotal}
        serviceFeeAmount={serviceFeeAmount}
        orderTotal={invoiceOrderTotal}
        totalWithExchange={invoiceTotalWithExchange}
      />
    </div>
  );
}
