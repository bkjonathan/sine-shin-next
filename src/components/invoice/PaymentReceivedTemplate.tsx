"use client";

import type { RefObject } from "react";
import type { ShopSettings } from "@/types";

interface PaymentReceivedOrder {
  id: string;
  orderId: string;
}

interface PaymentReceivedCustomer {
  name: string | null;
}

interface PaymentReceivedTemplateProps {
  ref: RefObject<HTMLDivElement | null>;
  shop: ShopSettings | null;
  order: PaymentReceivedOrder;
  customer: PaymentReceivedCustomer | null;
  amountLabel: string;
  receivedDate: string;
}

export function PaymentReceivedTemplate({
  ref,
  shop,
  order,
  customer,
  amountLabel,
  receivedDate,
}: PaymentReceivedTemplateProps) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Merchant", value: shop?.shopName ?? "—" },
    ...(shop?.phone ? [{ label: "Phone", value: shop.phone }] : []),
    ...(shop?.address ? [{ label: "Address", value: shop.address }] : []),
    { label: "Order ID", value: order.orderId ?? order.id },
    ...(customer?.name ? [{ label: "Customer", value: customer.name }] : []),
  ];

  return (
    <div
      ref={ref}
      style={{
        width: "480px",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        background: "#f4f5f7",
        color: "#1e293b",
        boxSizing: "border-box",
        padding: "48px 36px",
      }}
    >
      {/* ── Shop logo / name ── */}
      <div style={{ textAlign: "center" }}>
        {shop?.logoUrl ? (
          <img
            src={shop.logoUrl}
            alt="logo"
            style={{ width: 128, height: 128, objectFit: "contain", margin: "0 auto", display: "block" }}
          />
        ) : (
          <p style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {shop?.shopName ?? "Sine Shin Manager"}
          </p>
        )}
      </div>

      {/* ── Check icon ── */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "#1a8f4c",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: "#1a8f4c", margin: "20px 0 6px", letterSpacing: "0.01em" }}>
        PAYMENT RECEIVED
      </p>
      <p style={{ textAlign: "center", fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.5 }}>
        Thank you for your payment.
        <br />
        Your transaction was successful.
      </p>

      {/* ── Detail card ── */}
      <div style={{ marginTop: 32, background: "white", borderRadius: 18, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "8px 24px" }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid #eef2f6",
              }}
            >
              <span style={{ fontSize: 14, color: "#64748b", whiteSpace: "nowrap" }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", textAlign: "right", maxWidth: 280, whiteSpace: "pre-line" }}>
                {row.value}
              </span>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid #eef2f6" }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>Amount Received</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#1a8f4c" }}>{amountLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 20px", borderTop: "1px solid #eef2f6" }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>Received Date</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{receivedDate}</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ background: "#1a8f4c", color: "white", textAlign: "center", padding: "18px 24px" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Thank you for your business!</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>We appreciate your trust and support.</p>
        </div>
      </div>
    </div>
  );
}
