"use client";

import type { RefObject } from "react";
import type { ShopSettings, CargoShipment } from "@/types";
import InvoiceQRCode from "@/components/invoice/InvoiceQRCode";

interface CargoShipmentLabelTemplateProps {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: "1px solid #eef2f6" }}>
      <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textAlign: "right", maxWidth: 300 }}>{value}</span>
    </div>
  );
}

const sectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase" as const,
  letterSpacing: "0.16em",
  margin: "0 0 8px",
};

const cardStyle = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  padding: "6px 20px",
  marginBottom: 20,
};

export function CargoShipmentLabelTemplate({
  ref,
  shop,
  shipment,
  orderDisplayId,
  categoryNames,
  totalWeight,
  note,
  customer,
}: CargoShipmentLabelTemplateProps) {
  const hasShipmentDetails = Boolean(orderDisplayId) || categoryNames.length > 0;

  return (
    <div
      ref={ref}
      style={{
        width: "520px",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "#f4f5f7",
        color: "#1e293b",
        boxSizing: "border-box",
      }}
    >
      {/* ── Header bar ── */}
      <div style={{ background: "linear-gradient(120deg, #1d4ed8, #0891b2)", padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {shop?.logoUrl && (
            <img src={shop.logoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
          )}
          <span style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{shop?.shopName ?? "Sine Shin Manager"}</span>
        </div>
        <span style={{ background: "rgba(255,255,255,0.16)", color: "white", borderRadius: 9999, padding: "5px 14px", fontSize: 11, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.12em" }}>
          Shipment Label
        </span>
      </div>

      <div style={{ padding: "28px 32px 32px" }}>
        {/* ── Top stats: Cargo No + Total Weight ── */}
        <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
          <div style={{ flex: 1, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <p style={sectionLabel}>Cargo No</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1, fontFamily: "monospace" }}>
              {shipment.cargoNo}
            </p>
          </div>
          <div style={{ width: 160, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
            <p style={sectionLabel}>Total Weight</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1 }}>
              {totalWeight.toFixed(2)}
              <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}> kg</span>
            </p>
          </div>
        </div>

        {/* ── Shipment details ── */}
        {hasShipmentDetails && (
          <>
            <p style={sectionLabel}>Shipment</p>
            <div style={cardStyle}>
              {orderDisplayId && <InfoRow label="Order No" value={orderDisplayId} />}
              {categoryNames.length > 0 && <InfoRow label="Category" value={categoryNames.join(", ")} />}
            </div>
          </>
        )}

        {/* ── Customer ── */}
        <p style={sectionLabel}>Customer</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 12px", lineHeight: 1.2 }}>
          {customer.name ?? "—"}
        </p>
        <div style={cardStyle}>
          {customer.phone && <InfoRow label="Phone" value={customer.phone} />}
          {customer.city && <InfoRow label="City" value={customer.city} />}
          {customer.address && <InfoRow label="Address" value={customer.address} />}
          {customer.customerId && <InfoRow label="Customer ID" value={customer.customerId} />}
        </div>

        {/* ── Note ── */}
        {note && (
          <div style={{ background: "white", borderRadius: 18, border: "1px solid #e2e8f0", padding: "14px 20px", marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em" }}>Note</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 500, color: "#0f172a", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{note}</p>
          </div>
        )}

        {/* ── QR + footer ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px dashed #cbd5e1", paddingTop: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Generated by</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{shop?.shopName ?? "Sine Shin Manager"}</p>
          </div>
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
            size={88}
          />
        </div>
      </div>
    </div>
  );
}
