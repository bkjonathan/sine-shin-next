"use client";

import { useState, useRef, useEffect, useId, Fragment } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Search, ChevronDown, Check, Plus, Tag, Pencil, PackageOpen } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassTextarea } from "@/components/ui/glass-textarea";
import { CustomerCombobox } from "@/components/orders/customer-combobox";
import { useOrders, useOrderItems } from "@/hooks/use-orders";
import { useCargoCategories } from "@/hooks/use-cargo-categories";
import { useAddCargoItem, useRemoveCargoItem, useUpdateCargoItem } from "@/hooks/use-cargo";
import { useDebounce } from "@/hooks/use-debounce";
import { calculateCargoItemAmounts } from "@/utils/cargoCalculations";
import type { ReceiverBalance, ReceiverPaymentStatus } from "@/utils/cargoCalculations";
import { cn, formatCurrency } from "@/lib/utils";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";
import { CargoItemRowActions } from "@/components/cargo/cargo-item-row-actions";
import type { CargoItemWithLabels, ShopSettings, CargoShipment } from "@/types";

interface CargoItemsSectionProps {
  cargoShipmentId: string;
  items: CargoItemWithLabels[];
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "carrierPhone" | "flightNumber" | "status" | "exchangeRate" | "createdAt">;
  // Receiver paid/owed status per customer, so each item shows whether it's paid.
  receiverBalances: Map<string, ReceiverBalance>;
}

const RECEIVER_STATUS_META: Record<ReceiverPaymentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "border-success/30 bg-success/10 text-success" },
  partial: { label: "Partial", className: "border-warning/30 bg-warning/10 text-warning" },
  unpaid: { label: "Unpaid", className: "border-line text-t4" },
};

function ReceiverPaidBadge({ balance, currencySymbol }: { balance: ReceiverBalance | undefined; currencySymbol: string }) {
  if (!balance) return null;
  const meta = RECEIVER_STATUS_META[balance.status];
  const title =
    balance.status === "paid"
      ? `Receiver paid ${formatCurrency(balance.paid, currencySymbol)} in full`
      : `Paid ${formatCurrency(balance.paid, currencySymbol)} of ${formatCurrency(balance.owed, currencySymbol)} · ${formatCurrency(balance.balance, currencySymbol)} left`;
  return (
    <span
      title={title}
      className={cn(
        "mt-1 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
      {balance.status === "partial" && (
        <span className="font-medium normal-case tracking-normal opacity-80">
          · {formatCurrency(balance.balance, currencySymbol)} left
        </span>
      )}
    </span>
  );
}

/**
 * Cost cell that reveals the exchange-rate conversion on hover. Freight costs are
 * kept in the base currency; hovering shows what the same amount is worth in the
 * receiver's currency (base × the shipment's exchange rate), e.g. ฿ → Ks.
 */
function ExchangeCostCell({
  amount,
  label,
  rate,
  baseSymbol,
  exchangeSymbol,
  exchangeCode,
}: {
  amount: number;
  label: string;
  rate: number;
  baseSymbol: string;
  exchangeSymbol: string;
  exchangeCode: string;
}) {
  const base = formatCurrency(amount, baseSymbol);
  // Nothing to convert when the shipment has no distinct exchange rate.
  if (!(rate > 0) || rate === 1) return <>{base}</>;

  const converted = amount * rate;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-t4/40 underline-offset-[3px]">
          {base}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 rounded-xl border border-line bg-panel px-3 py-2.5 text-left shadow-[var(--shadow-card)] backdrop-blur-2xl"
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-t4">{label}</p>
          <div className="flex items-center justify-between gap-6 font-mono text-xs text-t2">
            <span>{base}</span>
            <span className="text-t4">× {rate.toFixed(4)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-divide pt-1.5 font-mono text-xs font-semibold text-t1">
            <span className="text-t4">=</span>
            <span>
              {formatCurrency(converted, exchangeSymbol)}{" "}
              <span className="text-[10px] font-medium text-t4">{exchangeCode}</span>
            </span>
          </div>
          <Tooltip.Arrow className="fill-panel" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const WHOLE_ORDER = "__whole_order__";

type ItemSource = "order" | "customer";

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

// Click-to-edit bag label used both as a group-header (rename the whole bag)
// and as a per-item chip (move a single item to another bag). Typing offers the
// bags already used in this shipment as `datalist` suggestions.
function BagInlineEdit({
  value,
  suggestions,
  placeholder,
  variant = "chip",
  onSave,
}: {
  value: string | null;
  suggestions: string[];
  placeholder: string;
  variant?: "chip" | "header";
  onSave: (next: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.focus());
  }, [editing]);

  function commit() {
    const next = draft.trim() || null;
    if (next !== (value ?? null)) onSave(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex items-center">
        <input
          ref={inputRef}
          list={listId}
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
          }}
          onBlur={commit}
          placeholder={placeholder}
          className={cn(
            "rounded-lg border border-accent-border bg-field px-2 py-0.5 text-t1 outline-none ring-2 ring-accent-bg/60",
            variant === "header" ? "w-44 text-sm font-semibold" : "w-28 text-xs"
          )}
        />
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={cn(
        "group/bag inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-accent-bg/40",
        variant === "header" ? "text-sm font-semibold text-t1" : "text-xs text-t4"
      )}
    >
      <Tag className={variant === "header" ? "h-3.5 w-3.5 text-accent" : "h-3 w-3"} />
      <span className={cn(!value && "italic")}>{value || placeholder}</span>
      <Pencil className="h-2.5 w-2.5 text-t4 opacity-0 transition-opacity group-hover/bag:opacity-100" />
    </button>
  );
}

export function CargoItemsSection({ cargoShipmentId, items, shop, shipment, receiverBalances }: CargoItemsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<ItemSource>("order");
  const [orderId, setOrderId] = useState("");
  const [orderLabel, setOrderLabel] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [itemMode, setItemMode] = useState(WHOLE_ORDER);
  const [categoryId, setCategoryId] = useState("");
  const [weightKg, setWeightKg] = useState(0);
  const [carrierRate, setCarrierRate] = useState(0);
  const [receiverRate, setReceiverRate] = useState(0);
  const [bagLabel, setBagLabel] = useState("");
  const [note, setNote] = useState("");

  const { prefs } = useCurrencyPrefs();
  const { data: categories } = useCargoCategories();
  const { data: orderItems } = useOrderItems(orderId || undefined);
  const addItem = useAddCargoItem();
  const removeItem = useRemoveCargoItem();
  const updateItem = useUpdateCargoItem();
  const router = useRouter();

  // Distinct bag names already used in this shipment — power the autocomplete.
  const bagNames = Array.from(
    new Set(items.map((i) => i.bagLabel).filter((b): b is string => !!b))
  ).sort((a, b) => a.localeCompare(b));

  // Group items by bag so packing is scannable; unbagged items fall last.
  const bagGroups = (() => {
    const labeled = new Map<string, CargoItemWithLabels[]>();
    const unbagged: CargoItemWithLabels[] = [];
    for (const it of items) {
      if (it.bagLabel) {
        const arr = labeled.get(it.bagLabel);
        if (arr) arr.push(it);
        else labeled.set(it.bagLabel, [it]);
      } else {
        unbagged.push(it);
      }
    }
    const groups: { key: string; label: string | null; rows: CargoItemWithLabels[] }[] =
      Array.from(labeled.entries()).map(([label, rows]) => ({ key: `bag:${label}`, label, rows }));
    if (unbagged.length) groups.push({ key: "__no_bag__", label: null, rows: unbagged });
    return groups;
  })();
  // Only worth grouping once at least one bag exists.
  const showBagGroups = bagGroups.some((g) => g.label !== null);

  function renameBag(from: string, to: string | null) {
    updateItem.mutate(
      { cargoShipmentId, fromBagLabel: from, toBagLabel: to },
      { onSuccess: () => router.refresh() }
    );
  }

  function moveItemToBag(itemId: string, bag: string | null) {
    updateItem.mutate(
      { cargoShipmentId, itemId, bagLabel: bag },
      { onSuccess: () => router.refresh() }
    );
  }

  const categoryOptions = (categories ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
  const itemOptions = [
    { value: WHOLE_ORDER, label: "Whole order" },
    ...(orderItems ?? []).map((i) => ({
      value: i.id,
      label: `${i.productUrl ? i.productUrl.slice(0, 28) : "Item"} — ${i.productWeight ?? 0} kg`,
    })),
  ];

  function resetForm() {
    setSource("order");
    setOrderId(""); setOrderLabel(""); setCustomerId(""); setItemMode(WHOLE_ORDER);
    setCategoryId(""); setWeightKg(0); setCarrierRate(0); setReceiverRate(0);
    setBagLabel(""); setNote("");
    setAdding(false);
  }

  function handleSourceChange(next: ItemSource) {
    setSource(next);
    // Clear the other flow's selection so we never submit both.
    setOrderId(""); setOrderLabel(""); setCustomerId(""); setItemMode(WHOLE_ORDER);
    setWeightKg(0);
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

  const canAdd = source === "order" ? !!orderId && weightKg > 0 : !!customerId && weightKg > 0;

  function handleAdd() {
    if (!canAdd) return;
    addItem.mutate(
      {
        cargoShipmentId,
        orderId: source === "order" ? orderId : null,
        customerId: source === "customer" ? customerId : null,
        orderItemId: source === "order" && itemMode !== WHOLE_ORDER ? itemMode : null,
        categoryId: categoryId || null,
        bagLabel: bagLabel.trim() || null,
        weightKg,
        carrierRatePerKg: carrierRate,
        receiverRatePerKg: receiverRate,
        note: note.trim() || null,
      },
      { onSuccess: () => { resetForm(); router.refresh(); } }
    );
  }

  const renderRow = (item: CargoItemWithLabels) => {
    const { carrierAmount, receiverAmount, profit } = calculateCargoItemAmounts(item);
    // Order-based items group by order; direct-customer items each
    // stand alone (no order to group under).
    const groupKey = (i: CargoItemWithLabels) => i.orderId ?? `direct:${i.id}`;
    const orderGroup = items.filter((i) => groupKey(i) === groupKey(item));
    const groupCategoryNames = Array.from(new Set(orderGroup.map((i) => i.categoryName).filter((n): n is string => !!n)));
    const groupTotalWeight = orderGroup.reduce((s, i) => s + i.weightKg, 0);
    return (
      <tr key={item.id} className="border-b border-divide last:border-0">
        <td className="px-4 py-3 text-t1">
          <div className="flex flex-col gap-1">
            <div className="flex flex-col">
              {item.orderId ? (
                <>
                  <span className="font-mono text-xs">{item.orderDisplayId ?? "—"}</span>
                  {!item.orderItemId && <span className="text-xs text-t3">Whole order</span>}
                </>
              ) : (
                <>
                  <span className="text-xs font-medium text-t2">Direct</span>
                  {item.categoryName && <span className="text-xs text-t3">{item.categoryName}</span>}
                </>
              )}
            </div>
            <BagInlineEdit
              variant="chip"
              value={item.bagLabel}
              suggestions={bagNames}
              placeholder="+ add to bag"
              onSave={(next) => moveItemToBag(item.id, next)}
            />
          </div>
        </td>
        <td className="px-4 py-3 text-t2">
          <div className="flex flex-col">
            <span className="text-t1">{item.customerName ?? "—"}</span>
            {item.customerPhone && <span className="text-xs text-t3">{item.customerPhone}</span>}
            <ReceiverPaidBadge
              balance={item.receiverCustomerId ? receiverBalances.get(item.receiverCustomerId) : undefined}
              currencySymbol={prefs.currencySymbol}
            />
          </div>
        </td>
        <td className="px-4 py-3 text-right text-t2">{item.weightKg.toFixed(2)} kg</td>
        <td className="px-4 py-3 text-right text-t2">
          <ExchangeCostCell
            amount={carrierAmount}
            label="Carrier Cost"
            rate={shipment.exchangeRate}
            baseSymbol={prefs.currencySymbol}
            exchangeSymbol={prefs.exchangeCurrencySymbol}
            exchangeCode={prefs.exchangeCurrencyCode}
          />
        </td>
        <td className="px-4 py-3 text-right text-t2">
          <ExchangeCostCell
            amount={receiverAmount}
            label="Receiver Cost"
            rate={shipment.exchangeRate}
            baseSymbol={prefs.currencySymbol}
            exchangeSymbol={prefs.exchangeCurrencySymbol}
            exchangeCode={prefs.exchangeCurrencyCode}
          />
        </td>
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
  };

  // Weight / rate / note fields are shared by both the order and direct flows.
  const rateFields = (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GlassInput label="Weight (kg)" type="number" min={0} step={0.01} value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)} />
        <GlassInput label="Carrier Rate / kg" type="number" min={0} step={0.01} value={carrierRate} onChange={(e) => setCarrierRate(parseFloat(e.target.value) || 0)} />
        <GlassInput label="Receiver Rate / kg" type="number" min={0} step={0.01} value={receiverRate} onChange={(e) => setReceiverRate(parseFloat(e.target.value) || 0)} />
      </div>
      <GlassInput
        label="Bag / Group"
        list="cargo-bag-suggestions"
        value={bagLabel}
        onChange={(e) => setBagLabel(e.target.value)}
        maxLength={100}
        placeholder="e.g. Brown bag, 30kg bag — group items pushed into the same bag"
      />
      <datalist id="cargo-bag-suggestions">
        {bagNames.map((b) => <option key={b} value={b} />)}
      </datalist>
      <GlassTextarea
        label="Note"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note — shown on the customer label"
      />
    </>
  );

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
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
              {!showBagGroups
                ? items.map(renderRow)
                : bagGroups.map((group) => {
                    const sub = group.rows.reduce(
                      (acc, it) => {
                        const a = calculateCargoItemAmounts(it);
                        acc.weight += it.weightKg;
                        acc.carrier += a.carrierAmount;
                        acc.receiver += a.receiverAmount;
                        acc.profit += a.profit;
                        return acc;
                      },
                      { weight: 0, carrier: 0, receiver: 0, profit: 0 }
                    );
                    return (
                      <Fragment key={group.key}>
                        <tr className="border-y border-divide bg-topbar/70">
                          <td colSpan={2} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {group.label !== null ? (
                                <BagInlineEdit
                                  variant="header"
                                  value={group.label}
                                  suggestions={bagNames.filter((b) => b !== group.label)}
                                  placeholder="Bag name"
                                  onSave={(next) => renameBag(group.label!, next)}
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-t3">
                                  <PackageOpen className="h-3.5 w-3.5" /> No bag
                                </span>
                              )}
                              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-t3">
                                {group.rows.length} item{group.rows.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-t2">{sub.weight.toFixed(2)} kg</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-t2">
                            <ExchangeCostCell
                              amount={sub.carrier}
                              label="Bag Carrier Cost"
                              rate={shipment.exchangeRate}
                              baseSymbol={prefs.currencySymbol}
                              exchangeSymbol={prefs.exchangeCurrencySymbol}
                              exchangeCode={prefs.exchangeCurrencyCode}
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-t2">
                            <ExchangeCostCell
                              amount={sub.receiver}
                              label="Bag Receiver Cost"
                              rate={shipment.exchangeRate}
                              baseSymbol={prefs.currencySymbol}
                              exchangeSymbol={prefs.exchangeCurrencySymbol}
                              exchangeCode={prefs.exchangeCurrencyCode}
                            />
                          </td>
                          <td className={cn("px-4 py-2 text-right text-xs font-semibold", sub.profit >= 0 ? "text-success" : "text-danger")}>
                            {formatCurrency(sub.profit, prefs.currencySymbol)}
                          </td>
                          <td className="px-4 py-2" />
                        </tr>
                        {group.rows.map(renderRow)}
                      </Fragment>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <GlassCard padding="sm">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
              {([
                { value: "order", label: "From Order" },
                { value: "customer", label: "Direct from Customer" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSourceChange(opt.value)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium transition-all",
                    source === opt.value ? "bg-surface-hover text-t1 shadow-[var(--shadow-sm)]" : "text-t3 hover:text-t1"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {source === "order" ? (
              <>
                <OrderPicker value={orderId} label={orderLabel} onSelect={handleOrderSelect} />
                {orderId && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <GlassSelect label="Ship as" value={itemMode} onValueChange={handleItemModeChange} options={itemOptions} />
                      <GlassSelect label="Category" value={categoryId} onValueChange={handleCategoryChange} options={categoryOptions} placeholder="No category" />
                    </div>
                    {rateFields}
                  </>
                )}
              </>
            ) : (
              <>
                <CustomerCombobox value={customerId} onValueChange={setCustomerId} placeholder="Whose shipment is this?" />
                {customerId && (
                  <>
                    <GlassSelect label="Category" value={categoryId} onValueChange={handleCategoryChange} options={categoryOptions} placeholder="No category" />
                    {rateFields}
                  </>
                )}
              </>
            )}

            <div className="flex gap-2 justify-end">
              <GlassButton type="button" variant="secondary" size="sm" onClick={resetForm}>Cancel</GlassButton>
              <GlassButton type="button" size="sm" disabled={!canAdd} loading={addItem.isPending} onClick={handleAdd}>Add Item</GlassButton>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassButton variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Item
        </GlassButton>
      )}
    </div>
    </Tooltip.Provider>
  );
}
