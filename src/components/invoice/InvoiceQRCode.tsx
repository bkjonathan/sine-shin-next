"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";

interface QRData {
  orderId: string;
  customer: {
    name: string | null;
    phone: string | null;
    city?: string | null;
    address?: string | null;
    customer_id?: string | null;
  };
}

export default function InvoiceQRCode({ data, size = 100 }: { data: QRData; size?: number }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(JSON.stringify(data), { width: size, margin: 1 }).then(setUrl);
  }, [data, size]);

  return url ? <img src={url} alt="QR Code" style={{ width: size, height: size }} /> : null;
}
