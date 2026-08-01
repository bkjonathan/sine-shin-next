"use client";

import type { RefObject } from "react";
import type { ShopSettings, CargoShipment } from "@/types";
import InvoiceQRCode from "@/components/invoice/InvoiceQRCode";

// A 4in x 6in portrait label at 96 CSS dpi = 384 x 576 px. Rendered to a PNG
// and printed at exactly 4in x 6in, so what is designed here is what prints.
// Kept ink-light (white background, black text, rule lines) so it stays crisp
// and readable on thermal / label printers.
const LABEL_WIDTH = 384;
const LABEL_HEIGHT = 576;

const INK = "#0f172a";
const MUTED = "#475569";
const LINE = "#cbd5e1";

interface CargoShipmentLabel4x6TemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo">;
  orderDisplayId: string | null;
  categoryNames: string[];
  totalWeight: number;
  note: string | null;
  customer: {
    name: string | null;
    customerId: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }}>
      <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK, textAlign: "right", maxWidth: 230 }}>{value}</span>
    </div>
  );
}

export function CargoShipmentLabel4x6Template({
  ref,
  shop,
  shipment,
  orderDisplayId,
  categoryNames,
  totalWeight,
  note,
  customer,
}: CargoShipmentLabel4x6TemplateProps) {
  const shopName = shop?.shopName ?? "Sine Shin Manager";

  return (
    <div
      ref={ref}
      style={{
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "#ffffff",
        color: INK,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        padding: "20px 22px",
        border: `1px solid ${LINE}`,
      }}
    >
      {/* ── Header: shop identity + label tag ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {shop?.logoUrl && (
            <img src={shop.logoUrl} alt="logo" style={{ width: 28, height: 28, objectFit: "contain" }} />
          )}
          <span style={{ fontSize: 14, fontWeight: 800, color: INK, letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shopName}
          </span>
        </div>
        <span style={{ border: `1.5px solid ${INK}`, color: INK, borderRadius: 6, padding: "3px 9px", fontSize: 9, textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
          Shipment Label
        </span>
      </div>

      {/* thick rule under header */}
      <div style={{ borderTop: `3px solid ${INK}` }} />

      {/* ── Cargo No + Total Weight (the focus of a shipment label) ── */}
      <div style={{ paddingTop: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 6px" }}>
            Cargo No
          </p>
          <p style={{ fontSize: 26, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.1, fontFamily: "monospace", letterSpacing: "0.02em" }}>
            {shipment.cargoNo}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 6px" }}>
            Weight
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.1 }}>
            {totalWeight.toFixed(2)}
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}> kg</span>
          </p>
        </div>
      </div>

      {/* ── Customer ── */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 6px" }}>
          Customer
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, color: INK, margin: "0 0 6px", lineHeight: 1.15 }}>
          {customer.name ?? "—"}
        </p>
        {customer.address && (
          <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: "0 0 3px", lineHeight: 1.35 }}>{customer.address}</p>
        )}
        {customer.city && <p style={{ fontSize: 12, color: MUTED, margin: "0 0 3px" }}>{customer.city}</p>}
        {customer.phone && (
          <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: "5px 0 0" }}>Tel: {customer.phone}</p>
        )}
      </div>

      {/* ── Reference details ── */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 4 }}>
        {orderDisplayId && <MetaRow label="Order No" value={orderDisplayId} />}
        {categoryNames.length > 0 && <MetaRow label="Category" value={categoryNames.join(", ")} />}
        {customer.customerId && <MetaRow label="Customer ID" value={customer.customerId} />}
      </div>

      {/* ── Note ── */}
      {note && (
        <div style={{ marginTop: 12, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "9px 12px" }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>Note</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{note}</p>
        </div>
      )}

      {/* ── Footer: generated-by + QR ── */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `2px dashed ${INK}`, paddingTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          {orderDisplayId && (
            <>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>Order No</p>
              <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 800, color: INK, fontFamily: "monospace" }}>{orderDisplayId}</p>
            </>
          )}
          <p style={{ margin: `${orderDisplayId ? 10 : 0}px 0 0`, fontSize: 10, color: MUTED }}>{shopName}</p>
        </div>
        <div style={{ padding: 6, border: `1px solid ${LINE}`, borderRadius: 8, background: "#ffffff", flexShrink: 0 }}>
          <InvoiceQRCode
            data={{
              orderId: shipment.cargoNo,
              customer: {
                name: customer.name,
                phone: customer.phone,
                city: customer.city,
                address: customer.address,
                customer_id: customer.customerId,
              },
            }}
            size={100}
          />
        </div>
      </div>
    </div>
  );
}
