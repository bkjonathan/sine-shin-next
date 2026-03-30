"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { useCurrencyPrefs } from "@/hooks/use-currency-prefs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  name: string;
  price: string;
  qty: string;
  feeOverride: string; // user-typed %, empty = auto
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServiceFeeRate(price: number): number {
  if (price < 1000) return 0.15;
  if (price <= 10000) return 0.1;
  return 0.05;
}


function calcRow(price: number, qty: number, exchangeRate: number, feeRate: number) {
  const priceWithFee = price * (1 + feeRate);
  const final = priceWithFee * qty * exchangeRate;
  return { priceWithFee, final };
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function newRow(): Row {
  return { id: crypto.randomUUID(), name: "", price: "", qty: "1", feeOverride: "" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-t3">
      {children}
    </p>
  );
}

function ReadonlyCell({ value, dim }: { value: string; dim?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-end rounded-xl px-3 text-sm tabular-nums",
        "border border-line bg-field/40 text-t1",
        dim && "text-t3"
      )}
    >
      {value}
    </div>
  );
}

function InlineInput({
  value,
  onChange,
  placeholder,
  type = "text",
  align = "left",
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  align?: "left" | "right";
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-10 w-full rounded-xl px-3 text-sm text-t1",
        "bg-field border border-line",
        "placeholder:text-t4",
        "outline-none transition-all duration-200",
        "focus:border-accent-border focus:ring-2 focus:ring-accent-bg/60",
        align === "right" && "text-right tabular-nums"
      )}
    />
  );
}

// ─── Mobile Row Card ──────────────────────────────────────────────────────────

function MobileRowCard({
  row,
  index,
  computed,
  canDelete,
  onUpdate,
  onRemove,
  sym,
}: {
  row: Row;
  index: number;
  computed: ReturnType<typeof calcRow> & { valid: boolean; price: number; qty: number; feeRate: number };
  canDelete: boolean;
  onUpdate: (field: keyof Row, value: string) => void;
  onRemove: () => void;
  sym: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 flex flex-col gap-3">
      {/* Name + delete */}
      <div className="flex items-center gap-2">
        <InlineInput
          value={row.name}
          onChange={(v) => onUpdate("name", v)}
          placeholder={`Item ${index + 1}`}
        />
        <button
          onClick={onRemove}
          disabled={!canDelete}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
            "text-t3 hover:bg-ios-red/10 hover:text-ios-red",
            "disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-t3"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Price + Qty */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <SectionLabel>Price</SectionLabel>
          <InlineInput
            value={row.price}
            onChange={(v) => onUpdate("price", v)}
            placeholder="0"
            type="number"
            inputMode="decimal"
            align="right"
          />
        </div>
        <div className="flex flex-col gap-1">
          <SectionLabel>Qty</SectionLabel>
          <InlineInput
            value={row.qty}
            onChange={(v) => onUpdate("qty", v)}
            placeholder="1"
            type="number"
            inputMode="numeric"
            align="right"
          />
        </div>
      </div>

      {/* Fee + w/ Fee + Final */}
      {computed.valid && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <SectionLabel>Fee %</SectionLabel>
            <InlineInput
              value={row.feeOverride !== "" ? row.feeOverride : String(computed.feeRate * 100)}
              onChange={(v) => onUpdate("feeOverride", v)}
              type="number"
              inputMode="decimal"
              align="right"
            />
          </div>
          <div className="flex flex-col gap-1">
            <SectionLabel>w/ Fee</SectionLabel>
            <ReadonlyCell value={fmt(computed.priceWithFee)} />
          </div>
          <div className="flex flex-col gap-1">
            <SectionLabel>Final</SectionLabel>
            <div className="flex h-10 items-center justify-end rounded-xl border border-accent-border bg-accent-bg px-3 text-sm font-semibold tabular-nums text-accent">
              {sym}{fmt(computed.final)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PriceCalculator() {
  const { prefs } = useCurrencyPrefs();
  const { exchangeRate, exchangeCurrencySymbol, exchangeCurrencyCode } = prefs;

  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [copied, setCopied] = useState(false);

  const updateRow = useCallback((id: string, field: keyof Row, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const computedRows = rows.map((r) => {
    const price = parseFloat(r.price);
    const qty = parseInt(r.qty, 10);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
      return { ...r, price, qty, feeRate: 0, priceWithFee: 0, final: 0, valid: false };
    }
    const parsedOverride = parseFloat(r.feeOverride);
    const feeRate = !isNaN(parsedOverride) && r.feeOverride.trim() !== ""
      ? parsedOverride / 100
      : getServiceFeeRate(price);
    const { priceWithFee, final } = calcRow(price, qty, exchangeRate, feeRate);
    return { ...r, price, qty, feeRate, priceWithFee, final, valid: true };
  });

  const grandTotal = computedRows.reduce((sum, r) => sum + (r.valid ? r.final : 0), 0);
  const validCount = computedRows.filter((r) => r.valid).length;

  const sym = exchangeCurrencySymbol || exchangeCurrencyCode;

  const handleCopy = useCallback(() => {
    const lines = computedRows
      .filter((r) => r.valid)
      .map((r) => {
        const feePctStr = `+${(r.feeRate * 100).toFixed(0)}%`;
        const label = r.name.trim() || "Item";
        return `${label}: ${fmt(r.price)} ${feePctStr} = ${fmt(r.priceWithFee)} × ${r.qty} × ${exchangeRate} = ${sym}${fmt(r.final)}`;
      });

    if (validCount > 1) {
      lines.push(`Total: ${sym}${fmt(grandTotal)}`);
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [computedRows, grandTotal, validCount, exchangeRate, sym]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-t3">
          Rate:{" "}
          <span className="font-medium text-t2">
            {sym}{exchangeRate} / {prefs.currencyCode || "unit"}
          </span>
          <span className="ml-2 hidden text-t4 sm:inline">· edit in Settings → Currency</span>
        </p>
        <GlassButton
          variant={copied ? "secondary" : "primary"}
          size="sm"
          onClick={handleCopy}
          disabled={validCount === 0}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy"}
        </GlassButton>
      </div>

      {/* Mobile: card-per-row layout */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row, i) => {
          const c = computedRows[i];
          return (
            <MobileRowCard
              key={row.id}
              row={row}
              index={i}
              computed={c}
              canDelete={rows.length > 1}
              onUpdate={(field, value) => updateRow(row.id, field, value)}
              onRemove={() => removeRow(row.id)}
              sym={sym}
            />
          );
        })}

        {/* Mobile total */}
        {validCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-accent-border bg-accent-bg px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-accent/70">
              Total
            </span>
            <span className="text-base font-bold tabular-nums text-accent">
              {sym}{fmt(grandTotal)}
            </span>
          </div>
        )}

        <GlassButton
          variant="ghost"
          size="sm"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Item
        </GlassButton>
      </div>

      {/* Desktop: table layout */}
      <GlassCard padding="sm" className="hidden md:block">
        {/* Column headers */}
        <div className="mb-2 grid grid-cols-[1fr_120px_72px_80px_100px_104px_36px] gap-2 px-1">
          {["Item Name", "Price", "Qty", "Fee", "w/ Fee", `Final (${sym})`, ""].map((h) => (
            <SectionLabel key={h}>{h}</SectionLabel>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const c = computedRows[i];
            return (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_120px_72px_80px_100px_104px_36px] items-center gap-2"
              >
                <InlineInput
                  value={row.name}
                  onChange={(v) => updateRow(row.id, "name", v)}
                  placeholder={`Item ${i + 1}`}
                />
                <InlineInput
                  value={row.price}
                  onChange={(v) => updateRow(row.id, "price", v)}
                  placeholder="0"
                  type="number"
                  inputMode="decimal"
                  align="right"
                />
                <InlineInput
                  value={row.qty}
                  onChange={(v) => updateRow(row.id, "qty", v)}
                  placeholder="1"
                  type="number"
                  inputMode="numeric"
                  align="right"
                />
                <InlineInput
                  value={c.valid ? (row.feeOverride !== "" ? row.feeOverride : String(c.feeRate * 100)) : ""}
                  onChange={(v) => updateRow(row.id, "feeOverride", v)}
                  placeholder="—"
                  type="number"
                  inputMode="decimal"
                  align="right"
                />
                <ReadonlyCell value={c.valid ? fmt(c.priceWithFee) : "—"} dim={!c.valid} />
                <ReadonlyCell
                  value={c.valid ? `${sym}${fmt(c.final)}` : "—"}
                  dim={!c.valid}
                />
                <button
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className={cn(
                    "flex h-10 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    "text-t3 hover:bg-ios-red/10 hover:text-ios-red",
                    "disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-t3"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Total */}
        {validCount > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="grid grid-cols-[1fr_120px_72px_80px_100px_104px_36px] gap-2 px-1">
              <div className="col-span-5 flex items-center justify-end pr-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-t3">
                  Total
                </span>
              </div>
              <div className="flex h-10 items-center justify-end rounded-xl border border-accent-border bg-accent-bg px-3 text-sm font-semibold tabular-nums text-accent">
                {sym}{fmt(grandTotal)}
              </div>
              <div />
            </div>
          </div>
        )}

        {/* Add row */}
        <div className="mt-3">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </GlassButton>
        </div>
      </GlassCard>

      {/* Copy preview */}
      {validCount > 0 && (
        <GlassCard padding="sm">
          <SectionLabel>Copy Preview</SectionLabel>
          <pre className="mt-2 overflow-x-auto text-xs leading-relaxed text-t2">
            {computedRows
              .filter((r) => r.valid)
              .map((r) => {
                const label = r.name.trim() || "Item";
                const feePctStr = `+${(r.feeRate * 100).toFixed(0)}%`;
                return `${label}: ${fmt(r.price)} ${feePctStr} = ${fmt(r.priceWithFee)} × ${r.qty} × ${exchangeRate} = ${sym}${fmt(r.final)}`;
              })
              .concat(validCount > 1 ? [`Total: ${sym}${fmt(grandTotal)}`] : [])
              .join("\n")}
          </pre>
        </GlassCard>
      )}
    </div>
  );
}
