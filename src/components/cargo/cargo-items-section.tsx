"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Search, ChevronDown, Check, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { useOrders, useOrderItems } from "@/hooks/use-orders";
import { useCargoCategories } from "@/hooks/use-cargo-categories";
import { useAddCargoItem, useRemoveCargoItem } from "@/hooks/use-cargo";
import { useDebounce } from "@/hooks/use-debounce";
import { calculateCargoItemAmounts } from "@/utils/cargoCalculations";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { CargoItemRowActions } from "@/components/cargo/cargo-item-row-actions";
import type { CargoItemWithLabels, ShopSettings, CargoShipment } from "@/types";

interface CargoItemsSectionProps {
  cargoShipmentId: string;
  items: CargoItemWithLabels[];
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "carrierPhone" | "flightNumber" | "status" | "exchangeRate" | "createdAt">;
}

const WHOLE_ORDER = "__whole_order__";

function OrderPicker({
  value,
  label,
  onSelect,
}: {
  value: string;
  label: string;
  onSelect: (orderId: string, orderLabel: string, totalWeight: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useOrders({
    limit: 10,
    search: debouncedSearch || undefined,
    searchField: debouncedSearch ? "customerName" : undefined,
    sort: "createdAt",
    order: "desc",
  });
  const results = data?.data ?? [];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm",
            "bg-field border border-line text-t1 backdrop-blur-xl outline-none transition-all duration-200",
            "focus:border-accent-border focus:ring-4 focus:ring-accent-bg/60",
            !value && "text-t4"
          )}
        >
          <span className="truncate">{label || "Search order..."}</span>
          <ChevronDown className="h-4 w-4 text-t3 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border border-line bg-panel backdrop-blur-2xl shadow-[var(--shadow-card)]"
          sideOffset={4}
          align="start"
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search className="h-4 w-4 text-t3 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name..."
              className="w-full bg-transparent text-sm text-t1 placeholder:text-t4 outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-t3">Loading...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-t3">No orders found</div>
            ) : (
              results.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onSelect(o.id, `${o.orderId} — ${o.customerName ?? "—"}`, o.totalWeight ?? 0);
                    setSearch("");
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-t2 outline-none select-none",
                    "hover:bg-surface-hover hover:text-t1",
                    value === o.id && "bg-surface-hover text-t1"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-mono text-xs">{o.orderId}</span>
                    <span className="text-xs text-t3">{o.customerName ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-t3">{(o.totalWeight ?? 0).toFixed(2)} kg</span>
                    {value === o.id && <Check className="h-3.5 w-3.5 text-accent" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CargoItemsSection({ cargoShipmentId, items, shop, shipment }: CargoItemsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderLabel, setOrderLabel] = useState("");
  const [itemMode, setItemMode] = useState(WHOLE_ORDER);
  const [categoryId, setCategoryId] = useState("");
  const [weightKg, setWeightKg] = useState(0);
  const [carrierRate, setCarrierRate] = useState(0);
  const [receiverRate, setReceiverRate] = useState(0);
  const [note, setNote] = useState("");

  const { prefs } = useCurrencyPrefs();
  const { data: categories } = useCargoCategories();
  const { data: orderItems } = useOrderItems(orderId || undefined);
  const addItem = useAddCargoItem();
  const removeItem = useRemoveCargoItem();
  const router = useRouter();

  const categoryOptions = (categories ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
  const itemOptions = [
    { value: WHOLE_ORDER, label: "Whole order" },
    ...(orderItems ?? []).map((i) => ({
      value: i.id,
      label: `${i.productUrl ? i.productUrl.slice(0, 28) : "Item"} — ${i.productWeight ?? 0} kg`,
    })),
  ];

  function resetForm() {
    setOrderId(""); setOrderLabel(""); setItemMode(WHOLE_ORDER);
    setCategoryId(""); setWeightKg(0); setCarrierRate(0); setReceiverRate(0);
    setNote("");
    setAdding(false);
  }

  function handleOrderSelect(id: string, label: string, totalWeight: number) {
    setOrderId(id);
    setOrderLabel(label);
    setItemMode(WHOLE_ORDER);
    setWeightKg(totalWeight);
  }

  function handleItemModeChange(mode: string) {
    setItemMode(mode);
    if (mode === WHOLE_ORDER) {
      const order = orderItems ?? [];
      setWeightKg(order.reduce((s, i) => s + (i.productWeight ?? 0), 0));
    } else {
      const item = orderItems?.find((i) => i.id === mode);
      setWeightKg(item?.productWeight ?? 0);
    }
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    const category = categories?.find((c) => c.id === id);
    if (category) {
      setCarrierRate(category.carrierRatePerKg);
      setReceiverRate(category.receiverRatePerKg);
    }
  }

  function handleAdd() {
    if (!orderId || weightKg <= 0) return;
    addItem.mutate(
      {
        cargoShipmentId,
        orderId,
        orderItemId: itemMode === WHOLE_ORDER ? null : itemMode,
        categoryId: categoryId || null,
        weightKg,
        carrierRatePerKg: carrierRate,
        receiverRatePerKg: receiverRate,
        note: note.trim() || null,
      },
      { onSuccess: () => { resetForm(); router.refresh(); } }
    );
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-[24px] border border-line bg-surface shadow-[var(--shadow-sm)]">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-divide bg-topbar">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-t3">Order</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em] text-t3">Customer</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Weight</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Carrier Cost</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Receiver Cost</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-t3">Profit</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const { carrierAmount, receiverAmount, profit } = calculateCargoItemAmounts(item);
                const orderGroup = items.filter((i) => i.orderId === item.orderId);
                const groupCategoryNames = Array.from(new Set(orderGroup.map((i) => i.categoryName).filter((n): n is string => !!n)));
                const groupTotalWeight = orderGroup.reduce((s, i) => s + i.weightKg, 0);
                return (
                  <tr key={item.id} className="border-b border-divide last:border-0">
                    <td className="px-4 py-3 text-t1">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{item.orderDisplayId ?? "—"}</span>
                        {!item.orderItemId && <span className="text-xs text-t3">Whole order</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-t2">
                      <div className="flex flex-col">
                        <span className="text-t1">{item.customerName ?? "—"}</span>
                        {item.customerPhone && <span className="text-xs text-t3">{item.customerPhone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-t2">{item.weightKg.toFixed(2)} kg</td>
                    <td className="px-4 py-3 text-right text-t2">{formatCurrency(carrierAmount, prefs.currencySymbol)}</td>
                    <td className="px-4 py-3 text-right text-t2">{formatCurrency(receiverAmount, prefs.currencySymbol)}</td>
                    <td className={cn("px-4 py-3 text-right font-medium", profit >= 0 ? "text-success" : "text-danger")}>
                      {formatCurrency(profit, prefs.currencySymbol)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <CargoItemRowActions
                          shop={shop}
                          shipment={shipment}
                          orderDisplayId={item.orderDisplayId}
                          note={item.note}
                          customer={{
                            name: item.customerName,
                            customerId: item.customerDisplayId,
                            phone: item.customerPhone,
                            address: item.customerAddress,
                            city: item.customerCity,
                          }}
                          invoiceItems={orderGroup}
                          exchangeCurrencyCode={prefs.exchangeCurrencyCode}
                          categoryNames={groupCategoryNames}
                          totalWeight={groupTotalWeight}
                          onRemove={() => {
                            const label = item.orderDisplayId ? `order ${item.orderDisplayId}` : "this item";
                            if (confirm(`Remove ${label} from the shipment?`)) {
                              removeItem.mutate({ cargoShipmentId, itemId: item.id }, { onSuccess: () => router.refresh() });
                            }
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <GlassCard padding="sm">
          <div className="space-y-3">
            <OrderPicker value={orderId} label={orderLabel} onSelect={handleOrderSelect} />
            {orderId && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <GlassSelect label="Ship as" value={itemMode} onValueChange={handleItemModeChange} options={itemOptions} />
                  <GlassSelect label="Category" value={categoryId} onValueChange={handleCategoryChange} options={categoryOptions} placeholder="No category" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <GlassInput label="Weight (kg)" type="number" min={0} step={0.01} value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)} />
                  <GlassInput label={`Carrier Rate / kg`} type="number" min={0} step={0.01} value={carrierRate} onChange={(e) => setCarrierRate(parseFloat(e.target.value) || 0)} />
                  <GlassInput label={`Receiver Rate / kg`} type="number" min={0} step={0.01} value={receiverRate} onChange={(e) => setReceiverRate(parseFloat(e.target.value) || 0)} />
                </div>
                <GlassTextarea
                  label="Note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note — shown on the customer label"
                />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <GlassButton type="button" variant="secondary" size="sm" onClick={resetForm}>Cancel</GlassButton>
              <GlassButton type="button" size="sm" disabled={!orderId || weightKg <= 0} loading={addItem.isPending} onClick={handleAdd}>Add Item</GlassButton>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassButton variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Item
        </GlassButton>
      )}
    </div>
  );
}
