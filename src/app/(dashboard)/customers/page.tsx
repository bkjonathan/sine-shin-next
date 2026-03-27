"use client";

import { useState } from "react";
import { useCustomers } from "@/hooks/use-customers";
import { CustomerTable } from "@/components/customers/customer-table";
import { PageHeader } from "@/components/layout/page-header";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomerForm } from "@/components/customers/customer-form";
import { useCreateCustomer } from "@/hooks/use-customers";
import { Plus } from "lucide-react";
import type { CreateCustomerInput } from "@/validations/customer.schema";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const createCustomer = useCreateCustomer();

  const { data, isLoading } = useCustomers({ page, search, limit: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${data?.meta?.total ?? 0} total customers`}
        actions={
          <GlassButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </GlassButton>
        }
      />

      {/* Search */}
      <div className="max-w-lg rounded-[28px] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <GlassInput
          placeholder="Search by name, ID, or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <CustomerTable customers={data?.data ?? []} isLoading={isLoading} />

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </GlassButton>
          <span className="text-sm text-t2">Page {page} of {data.meta.totalPages}</span>
          <GlassButton variant="secondary" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </GlassButton>
        </div>
      )}

      <GlassModal open={creating} onOpenChange={setCreating} title="New Customer">
        <CustomerForm
          onSubmit={(d: CreateCustomerInput) => createCustomer.mutate(d, { onSuccess: () => setCreating(false) })}
          isLoading={createCustomer.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>
    </div>
  );
}
