"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/use-orders";
import { OrderTable } from "@/components/orders/order-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassSelect } from "@/components/ui/glass-select";
import { GlassModal } from "@/components/ui/glass-modal";
import { OrderForm } from "@/components/orders/order-form";
import { useCreateOrder } from "@/hooks/use-orders";
import { Plus } from "lucide-react";
import type { CreateOrderInput } from "@/validations/order.schema";
import { ORDER_STATUSES } from "@/validations/order.schema";

const statusOptions = ORDER_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const createOrder = useCreateOrder();

  const { data, isLoading } = useOrders({ page, search, status, limit: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${data?.meta?.total ?? 0} total orders`}
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Order
          </GlassButton>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="w-72">
          <GlassInput
            placeholder="Search by order ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
          <GlassSelect
            options={statusOptions}
            value={status}
            onValueChange={(v) => { setStatus(v); setPage(1); }}
            placeholder="All statuses"
          />
        </div>
      </div>

      <OrderTable orders={data?.data ?? []} isLoading={isLoading} />

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </GlassButton>
          <span className="text-sm text-white/50">Page {page} of {data.meta.totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </GlassButton>
        </div>
      )}

      <GlassModal open={creating} onOpenChange={setCreating} title="New Order" size="lg">
        <OrderForm
          onSubmit={(d: CreateOrderInput) => createOrder.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createOrder.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}
