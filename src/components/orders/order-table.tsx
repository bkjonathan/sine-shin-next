"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { OrderStatusBadge } from "./order-status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useDeleteOrder } from "@/hooks/use-orders";
import { Pencil, Trash2, Printer } from "lucide-react";
import Link from "next/link";

interface OrderRow {
  id: string;
  orderId: string;
  status: string;
  shippingFee: number;
  deliveryFee: number;
  cargoFee: number;
  serviceFee: number;
  createdAt: Date | string;
  customerName?: string | null;
  customerDisplayId?: string | null;
  totalQty?: number | null;
  totalWeight?: number | null;
}

interface OrderTableProps {
  orders: OrderRow[];
  isLoading?: boolean;
  pageOffset?: number;
}

export function OrderTable({ orders, isLoading, pageOffset = 0 }: OrderTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deleteOrder = useDeleteOrder();

  const allIds = orders.map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handlePrint = (o: OrderRow) => {
    const win = window.open("", "_blank", "width=400,height=320");
    if (!win) return;
    const total = (o.shippingFee ?? 0) + (o.deliveryFee ?? 0) + (o.cargoFee ?? 0) + (o.serviceFee ?? 0);
    win.document.write(`
      <html><head><title>Order Label</title>
      <style>body{font-family:sans-serif;padding:20px}h2{margin:0 0 8px}p{margin:4px 0;font-size:14px}</style>
      </head><body>
      <h2>${o.orderId}</h2>
      ${o.customerName ? `<p>Customer: ${o.customerName}</p>` : ""}
      <p>Status: ${o.status}</p>
      <p>Total: $${total.toLocaleString()}</p>
      <p>Date: ${formatDate(o.createdAt)}</p>
      <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `);
    win.document.close();
  };

  const columns: ColumnDef<OrderRow>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-line accent-[var(--accent)]"
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.has(row.original.id)}
          onChange={() => toggleOne(row.original.id)}
          className="h-4 w-4 rounded border-line accent-[var(--accent)]"
          aria-label="Select row"
        />
      ),
    },
    {
      accessorKey: "orderId",
      header: "ORDER ID",
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.id}`} className="hover:opacity-80">
          <span className="inline-flex items-center rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-t2">
            {row.original.orderId}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "customerName",
      header: "CUSTOMER",
      cell: ({ row }) => {
        const name = row.original.customerName;
        if (!name) return <span className="text-sm text-t3">—</span>;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
              {name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-t1">{name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "STATUS",
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "DATE",
      cell: ({ row }) => (
        <span className="text-sm text-t2">{formatDate(row.original.createdAt, "dd-MM-yyyy")}</span>
      ),
    },
    {
      id: "qty",
      header: "QTY",
      cell: ({ row }) => (
        <span className="text-sm text-t1">{row.original.totalQty ?? 0}</span>
      ),
    },
    {
      id: "total",
      header: "TOTAL",
      cell: ({ row }) => {
        const total =
          (row.original.shippingFee ?? 0) +
          (row.original.deliveryFee ?? 0) +
          (row.original.cargoFee ?? 0) +
          (row.original.serviceFee ?? 0);
        return <span className="text-sm font-semibold text-t1">{formatCurrency(total)}</span>;
      },
    },
    {
      id: "weight",
      header: "WEIGHT (KG)",
      cell: ({ row }) => {
        const w = row.original.totalWeight ?? 0;
        return <span className="text-sm text-t2">{w > 0 ? `${w} kg` : "0 kg"}</span>;
      },
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => handlePrint(row.original)}
            aria-label="Print label"
          >
            <Printer className="h-3.5 w-3.5" />
          </GlassButton>
          <GlassButton variant="ghost" size="sm" asChild aria-label="Edit order">
            <Link href={`/orders/${row.original.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this order?")) deleteOrder.mutate(row.original.id); }}
            className="hover:text-danger"
            aria-label="Delete order"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <DataTable columns={columns} data={orders} isLoading={isLoading} emptyMessage="No orders found" />
  );
}
