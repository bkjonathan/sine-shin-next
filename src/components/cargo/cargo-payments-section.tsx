"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { CustomerCombobox } from "@/components/orders/customer-combobox";
import { CargoPaymentReceiptButton } from "@/components/cargo/cargo-payment-receipt-button";
import { useAddCargoPayment, useRemoveCargoPayment } from "@/hooks/use-cargo";
import { convertPaymentToBase } from "@/utils/cargoCalculations";
import { formatDate, cn } from "@/lib/utils";
import type { CargoPaymentWithCustomer, ShopSettings } from "@/types";
import type { CargoPartyType } from "@/validations/cargo.schema";

interface CargoPaymentsSectionProps {
  cargoShipmentId: string;
  cargoNo: string;
  carrierName: string | null;
  shop: ShopSettings | null;
  partyType: CargoPartyType;
  payments: CargoPaymentWithCustomer[];
  owed: number;
  paid: number;
  shipmentExchangeRate: number;
  baseCurrencySymbol: string;
  baseCurrencyCode: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** First+last initials for the payer avatar, e.g. "Aung Khaing Min" -> "AM". */
function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CargoPaymentsSection({
  cargoShipmentId,
  cargoNo,
  carrierName,
  shop,
  partyType,
  payments,
  owed,
  paid,
  shipmentExchangeRate,
  baseCurrencySymbol,
  baseCurrencyCode,
}: CargoPaymentsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState(partyType === "receiver" ? "MMK" : "USD");
  const [exchangeRate, setExchangeRate] = useState(shipmentExchangeRate);
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");

  const addPayment = useAddCargoPayment();
  const removePayment = useRemoveCargoPayment();
  const router = useRouter();
  const balance = owed - paid;

  function resetForm() {
    setCustomerId(""); setAmount(0); setCurrency(partyType === "receiver" ? "MMK" : "USD");
    setExchangeRate(shipmentExchangeRate); setPaidAt(todayISO()); setMethod(""); setNote("");
    setAdding(false);
  }

  function handleAdd() {
    if (amount <= 0) return;
    if (partyType === "receiver" && !customerId) return;
    addPayment.mutate(
      {
        cargoShipmentId,
        partyType,
        customerId: partyType === "receiver" ? customerId : null,
        amount,
        currency,
        exchangeRate,
        paidAt,
        method: method || null,
        note: note || null,
      },
      { onSuccess: () => { resetForm(); router.refresh(); } }
    );
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-t3">
          {partyType === "carrier" ? "Carrier Payments" : "Receiver Payments"}
        </h3>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-hover p-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Owed</p>
          <p className="text-sm font-semibold text-t1">{baseCurrencySymbol} {owed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Paid</p>
          <p className="text-sm font-semibold text-success">{baseCurrencySymbol} {paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-t4">Balance</p>
          <p className={cn("text-sm font-semibold", balance > 0 ? "text-warning" : "text-success")}>
            {baseCurrencySymbol} {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {payments.map((p) => {
            const converted = partyType === "receiver" && p.currency.toUpperCase() !== baseCurrencyCode.toUpperCase();
            const baseAmount = convertPaymentToBase(
              { partyType, amount: p.amount, currency: p.currency, exchangeRate: p.exchangeRate },
              shipmentExchangeRate,
              baseCurrencyCode,
            );
            const payer = partyType === "receiver" ? p.customerName : carrierName;
            return (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:bg-surface-hover">
              {/* WHO paid — the primary identifier for this row */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent">
                {initials(payer)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-t1">
                  {payer || <span className="text-t4">No name</span>}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-xs text-t4">
                  <span>{formatDate(p.paidAt)}</span>
                  {p.method && <span>· {p.method}</span>}
                  {p.note && <span className="truncate text-t3">· {p.note}</span>}
                </div>
              </div>
              {/* HOW MUCH — counted toward the balance, shown in base currency */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-success">
                  {baseCurrencySymbol} {baseAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {converted && (
                  <p className="text-xs tabular-nums text-t4">
                    {p.amount.toLocaleString()} {p.currency}
                    {p.exchangeRate ? ` · @${p.exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <CargoPaymentReceiptButton
                  shop={shop}
                  cargoNo={cargoNo}
                  partyType={partyType}
                  partyName={payer}
                  amount={p.amount}
                  currency={p.currency}
                  paidAt={p.paidAt}
                  method={p.method}
                  note={p.note}
                />
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => removePayment.mutate({ cargoShipmentId, paymentId: p.id }, { onSuccess: () => router.refresh() })}
                  className="hover:text-danger"
                  aria-label="Remove payment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </GlassButton>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="space-y-3">
          {partyType === "receiver" && (
            <CustomerCombobox value={customerId} onValueChange={setCustomerId} placeholder="Which customer paid?" allowCreate={false} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
            <GlassInput label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Exchange Rate" type="number" min={0.0001} step={0.0001} value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || shipmentExchangeRate)} />
            <GlassInput label="Date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GlassInput label="Method" placeholder="Cash, bank..." value={method} onChange={(e) => setMethod(e.target.value)} />
            <GlassInput label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="secondary" size="sm" onClick={resetForm}>Cancel</GlassButton>
            <GlassButton
              type="button"
              size="sm"
              loading={addPayment.isPending}
              disabled={amount <= 0 || (partyType === "receiver" && !customerId)}
              onClick={handleAdd}
            >
              Add Payment
            </GlassButton>
          </div>
        </div>
      ) : (
        <GlassButton variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Payment
        </GlassButton>
      )}
    </GlassCard>
  );
}
