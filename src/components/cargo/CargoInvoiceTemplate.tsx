"use client";

import type { RefObject } from "react";
import type { ShopSettings } from "@/types";
import type { CargoShipment, CargoItemWithLabels } from "@/types";
import { formatPrice } from "@/utils/invoiceCalculations";

interface CargoInvoiceTemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  shipment: Pick<CargoShipment, "cargoNo" | "carrierName" | "exchangeRate" | "createdAt">;
  items: CargoItemWithLabels[];
  totalWeight: number;
  receiverOwed: number;
  totalWithExchange: number;
  exchangeCurrencyCode: string;
}

export function CargoInvoiceTemplate({
  ref,
  shop,
  shipment,
  items,
  totalWeight,
  receiverOwed,
  totalWithExchange,
  exchangeCurrencyCode,
}: CargoInvoiceTemplateProps) {
  return (
    <div
      ref={ref}
      style={{
        width: "920px",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "white",
        fontSize: 14,
        color: "#334155",
        boxSizing: "border-box",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(180deg, #eff6ff, white)", padding: "32px 40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {shop?.logoUrl && (
              <img
                src={shop.logoUrl}
                alt="logo"
                style={{ width: 96, height: 96, borderRadius: 8, border: "1px solid #f1f5f9", objectFit: "contain" }}
              />
            )}
            <div>
              <p style={{ fontSize: 30, fontWeight: 700, color: "#0f172a", margin: 0 }}>{shop?.shopName}</p>
              {shop?.phone && (
                <p style={{ fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 0 }}>Tel: {shop.phone}</p>
              )}
              {shop?.address && (
                <p style={{ fontSize: 14, color: "#64748b", maxWidth: 300, lineHeight: 1.5, margin: 0 }}>{shop.address}</p>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ display: "inline-block", background: "linear-gradient(to right, #2563eb, #06b6d4, #14b8a6)", color: "white", borderRadius: 9999, padding: "4px 16px", fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>
              Cargo Invoice
            </span>
            <p style={{ fontSize: 14, color: "#475569", marginTop: 8, marginBottom: 0 }}>#{shipment.cargoNo}</p>
            {shipment.createdAt && (
              <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{new Date(shipment.createdAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 40px" }}>
        {/* ── SHIPMENT DETAILS ── */}
        <div style={{ background: "#f8fafc", border: "1px solid #dbeafe", borderRadius: 14, padding: 16, marginTop: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, marginTop: 0 }}>
            Shipment Details
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 140px 1fr", gap: "6px 0", fontSize: 13 }}>
            {shipment.carrierName && (
              <><span style={{ color: "#64748b" }}>Carrier</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{shipment.carrierName}</span></>
            )}
            <span style={{ color: "#64748b" }}>Total Weight</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{totalWeight.toFixed(2)} kg</span>
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div style={{ border: "1px solid #dbeafe", borderRadius: 14, overflow: "hidden", marginTop: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#eff6ff" }}>
                <th style={{ width: 40, textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>No.</th>
                <th style={{ textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Order</th>
                <th style={{ textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Customer</th>
                <th style={{ textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Category</th>
                <th style={{ width: 90, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Weight</th>
                <th style={{ width: 90, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Rate/kg</th>
                <th style={{ width: 110, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", padding: 12 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155" }}>{index + 1}</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155" }}>{item.orderDisplayId ?? "—"}</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155" }}>{item.customerName ?? "—"}</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155" }}>{item.categoryName ?? "—"}</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155", textAlign: "right" }}>{item.weightKg.toFixed(2)} kg</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155", textAlign: "right" }}>{formatPrice(item.receiverRatePerKg)}</td>
                  <td style={{ padding: 12, fontSize: 13, color: "#334155", textAlign: "right" }}>{formatPrice(item.weightKg * item.receiverRatePerKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── SUMMARY ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <div style={{ width: 340, background: "linear-gradient(170deg, white, #f8fafc, #eff6ff)", border: "1px solid #dbeafe", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 8 }}>
              <span>Total Weight</span>
              <span>{totalWeight.toFixed(2)} kg</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: 700, fontSize: 22, marginTop: 8 }}>
              <span>Total</span>
              <span>{formatPrice(receiverOwed)}</span>
            </div>
            {shipment.exchangeRate !== 1 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginTop: 8 }}>
                  <span>Exchange Rate</span>
                  <span>× {shipment.exchangeRate}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#334155", borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginTop: 8 }}>
                  <span>Total × Exchange Rate</span>
                  <span>{formatPrice(totalWithExchange)} {exchangeCurrencyCode}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Thank you for your business!</p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Generated by {shop?.shopName ?? "Sine Shin Manager"}</p>
        </div>
      </div>
    </div>
  );
}
