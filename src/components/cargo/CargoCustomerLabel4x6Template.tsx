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

interface CargoCustomerLabel4x6TemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo">;
  orderDisplayId: string | null;
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

export function CargoCustomerLabel4x6Template({
  ref,
  shop,
  shipment,
  orderDisplayId,
  note,
  customer,
}: CargoCustomerLabel4x6TemplateProps) {
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
          Customer Label
        </span>
      </div>

      {/* thick rule under header */}
      <div style={{ borderTop: `3px solid ${INK}` }} />

      {/* ── Recipient (the focus of a shipment label) ── */}
      <div style={{ paddingTop: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 6px" }}>
          Deliver To
        </p>
        <p style={{ fontSize: 27, fontWeight: 800, color: INK, margin: "0 0 10px", lineHeight: 1.12 }}>
          {customer.name ?? "—"}
        </p>

        {customer.address && (
          <p style={{ fontSize: 14, fontWeight: 600, color: INK, margin: "0 0 4px", lineHeight: 1.35 }}>
            {customer.address}
          </p>
        )}
        {customer.city && (
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 4px" }}>{customer.city}</p>
        )}
        {customer.phone && (
          <p style={{ fontSize: 15, fontWeight: 700, color: INK, margin: "6px 0 0" }}>
            Tel: {customer.phone}
          </p>
        )}
      </div>

      {/* ── Reference details ── */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 4 }}>
        {orderDisplayId && <MetaRow label="Order No" value={orderDisplayId} />}
        {customer.customerId && <MetaRow label="Customer ID" value={customer.customerId} />}
      </div>

      {/* ── Note ── */}
      {note && (
        <div style={{ marginTop: 12, border: `1.5px solid ${INK}`, borderRadius: 10, padding: "9px 12px" }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>Note</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{note}</p>
        </div>
      )}

      {/* ── Cargo number + QR ── */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `2px dashed ${INK}`, paddingTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.14em" }}>Cargo No</p>
          <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 800, color: INK, fontFamily: "monospace", letterSpacing: "0.02em" }}>{shipment.cargoNo}</p>
          <p style={{ margin: "10px 0 0", fontSize: 10, color: MUTED }}>{shopName}</p>
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
