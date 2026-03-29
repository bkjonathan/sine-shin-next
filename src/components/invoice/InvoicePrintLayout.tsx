"use client";

import type { RefObject } from "react";
import type { Order, OrderItem, ShopSettings } from "@/types";
import InvoiceQRCode from "./InvoiceQRCode";
import { formatPrice, calculateLineAmount, calculateTotalFees } from "@/utils/invoiceCalculations";

interface InvoiceCustomer {
  name: string | null;
  customerId: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  platform: string | null;
}

interface InvoicePrintLayoutProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  order: Order;
  customer: InvoiceCustomer | null;
  items: OrderItem[];
  itemsSubtotal: number;
  serviceFeeAmount: number;
  orderTotal: number;
  totalWithExchange: number;
}

export function InvoicePrintLayout({
  ref,
  shop,
  order,
  customer,
  items,
  itemsSubtotal,
  serviceFeeAmount,
  orderTotal,
  totalWithExchange,
}: InvoicePrintLayoutProps) {
  const isPercentFee = order.serviceFeeType === "%" || order.serviceFeeType === "percent";
  const totalFees = calculateTotalFees({
    shippingFee: order.shippingFee ?? 0,
    deliveryFee: order.deliveryFee ?? 0,
    cargoFee: order.cargoFee ?? 0,
    serviceFeeAmount,
  });

  return (
    <div
      ref={ref}
      id="invoice-print-container"
      style={{
        width: "800px",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "white",
        padding: 40,
        fontSize: 14,
        color: "#334155",
        boxSizing: "border-box",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 24, borderBottom: "2px solid #dbeafe" }}>
        {/* Left: Shop info */}
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

        {/* Right: Invoice badge + order meta */}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 36, fontWeight: 700, color: "#dbeafe", margin: 0 }}>INVOICE</p>
          <p style={{ fontSize: 14, color: "#475569", marginTop: 4, marginBottom: 0 }}>#{order.orderId ?? order.id}</p>
          {order.orderDate && (
            <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{order.orderDate}</p>
          )}
        </div>
      </div>

      {/* ── BILL TO ── */}
      <div style={{ marginTop: 24, padding: 20, background: "linear-gradient(140deg, #f8fbff, #eff6ff, #ecfeff)", border: "1px solid #dbeafe", borderRadius: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, marginTop: 0 }}>
          Bill To
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8, marginTop: 0 }}>
          {customer?.name}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 0", fontSize: 14 }}>
          {customer?.customerId && (
            <><span style={{ color: "#64748b" }}>Customer ID</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{customer.customerId}</span></>
          )}
          {customer?.phone && (
            <><span style={{ color: "#64748b" }}>Phone</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{customer.phone}</span></>
          )}
          {customer?.city && (
            <><span style={{ color: "#64748b" }}>City</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{customer.city}</span></>
          )}
          {customer?.address && (
            <><span style={{ color: "#64748b" }}>Address</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{customer.address}</span></>
          )}
          {order.orderFrom && (
            <><span style={{ color: "#64748b" }}>Platform</span><span style={{ color: "#0f172a", fontWeight: 500 }}>{order.orderFrom}</span></>
          )}
        </div>
      </div>

      {/* ── PRODUCTS TABLE ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #0f172a" }}>
            <th style={{ width: 48, textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", paddingBottom: 10 }}>No.</th>
            <th style={{ textAlign: "left", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Product Link</th>
            <th style={{ width: 96, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Qty</th>
            <th style={{ width: 128, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Price</th>
            <th style={{ width: 128, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "16px 0", fontSize: 14, color: "#334155" }}>{index + 1}</td>
              <td style={{ padding: "16px 0", fontSize: 14, color: "#334155", wordBreak: "break-all" }}>
                {item.productUrl ?? "—"}
              </td>
              <td style={{ padding: "16px 0", fontSize: 14, color: "#334155", textAlign: "right" }}>
                {item.productQty ?? 0}
              </td>
              <td style={{ padding: "16px 0", fontSize: 14, color: "#334155", textAlign: "right" }}>
                {formatPrice(item.price ?? 0)}
              </td>
              <td style={{ padding: "16px 0", fontSize: 14, color: "#334155", textAlign: "right" }}>
                {formatPrice(calculateLineAmount(item.price, item.productQty))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── SUMMARY + QR SECTION ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24, gap: 24 }}>
        {/* QR Code bottom-left */}
        <div>
          <InvoiceQRCode
            data={{ orderId: order.orderId ?? order.id, customer: { name: customer?.name ?? null, phone: customer?.phone ?? null } }}
            size={100}
          />
        </div>

        {/* Summary bottom-right, 50% width */}
        <div style={{ width: "50%", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
            <span>Subtotal</span>
            <span>{formatPrice(itemsSubtotal)}</span>
          </div>

          {(order.productDiscount ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
              <span>Product Discount</span>
              <span>{formatPrice(order.productDiscount ?? 0)}</span>
            </div>
          )}
          {serviceFeeAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
              <span>Service Fee{isPercentFee ? ` (${order.serviceFee}%)` : ""}</span>
              <span>{formatPrice(serviceFeeAmount)}</span>
            </div>
          )}
          {(order.shippingFee ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
              <span>Shipping Fee</span>
              <span>{formatPrice(order.shippingFee ?? 0)}</span>
            </div>
          )}
          {(order.deliveryFee ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
              <span>Delivery Fee</span>
              <span>{formatPrice(order.deliveryFee ?? 0)}</span>
            </div>
          )}
          {(order.cargoFee ?? 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155", marginBottom: 8 }}>
              <span>Cargo Fee</span>
              <span>{formatPrice(order.cargoFee ?? 0)}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 500, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginBottom: 8 }}>
            <span>Total Fees</span>
            <span>{formatPrice(totalFees)}</span>
          </div>

          {(order.exchangeRate ?? 1) !== 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#64748b", marginBottom: 8 }}>
              <span>Exchange Rate</span>
              <span>× {order.exchangeRate}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: 700, fontSize: 20, marginTop: 8 }}>
            <span>Total</span>
            <span>{formatPrice(orderTotal)}</span>
          </div>

          {(order.exchangeRate ?? 1) > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#334155", borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginTop: 8 }}>
              <span>Total × Exchange Rate</span>
              <span>{formatPrice(totalWithExchange)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Thank you for your business!</p>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Generated by {shop?.shopName ?? "Sine Shin Manager"}</p>
      </div>
    </div>
  );
}
