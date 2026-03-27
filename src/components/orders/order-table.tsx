"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { OrderForm } from "./order-form";
import { OrderStatusBadge } from "./order-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCreateOrder, useDeleteOrder } from "@/hooks/use-orders";
import { Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import type { CreateOrderInput } from "@/validations/order.schema";

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
}

interface OrderTableProps {
  orders: OrderRow[];
  isLoading?: boolean;
}

export function OrderTable({ orders, isLoading }: OrderTableProps) {
  const [creating, setCreating] = useState(false);
  const createOrder = useCreateOrder();
  const deleteOrder = useDeleteOrder();

  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: "orderId",
      header: "Order ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#007AFF]">{row.original.orderId}</span>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <span className="text-white/80">{row.original.customerName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <GlassButton variant="ghost" size="sm" asChild aria-label="View order">
            <Link href={`/orders/${row.original.id}`}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this order?")) deleteOrder.mutate(row.original.id); }}
            className="hover:text-[#FF3B30]"
            aria-label="Delete order"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={orders} isLoading={isLoading} emptyMessage="No orders yet" />

      <GlassModal open={creating} onOpenChange={setCreating} title="New Order" size="lg">
        <OrderForm
          onSubmit={(data: CreateOrderInput) => createOrder.mutate(data, { onSuccess: () => setCreating(false) })}
          isLoading={createOrder.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </>
  );
}
