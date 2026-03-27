"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomerForm } from "./customer-form";
import { formatDate } from "@/lib/utils";
import { useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/use-customers";
import { Pencil, Trash2 } from "lucide-react";
import type { Customer } from "@/types";
import type { CreateCustomerInput } from "@/validations/customer.schema";
import Link from "next/link";

interface CustomerTableProps {
  customers: Customer[];
  isLoading?: boolean;
}

export function CustomerTable({ customers, isLoading }: CustomerTableProps) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "customerId",
      header: "ID",
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.id}`} className="text-[#007AFF] hover:underline font-mono text-xs">
          {row.original.customerId}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium text-white/90">{row.original.name}</span> },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    { accessorKey: "createdAt", header: "Joined", cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <GlassButton variant="ghost" size="sm" onClick={() => setEditing(row.original)} aria-label="Edit customer">
            <Pencil className="h-3.5 w-3.5" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this customer?")) deleteCustomer.mutate(row.original.id); }}
            aria-label="Delete customer"
            className="hover:text-[#FF3B30]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={customers} isLoading={isLoading} emptyMessage="No customers yet" />

      {/* Create modal */}
      <GlassModal open={creating} onOpenChange={setCreating} title="New Customer" size="md">
        <CustomerForm
          onSubmit={(data: CreateCustomerInput) => createCustomer.mutate(data, { onSuccess: () => setCreating(false) })}
          isLoading={createCustomer.isPending}
          onCancel={() => setCreating(false)}
        />
      </GlassModal>

      {/* Edit modal */}
      <GlassModal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit Customer" size="md">
        {editing && (
          <CustomerForm
            defaultValues={editing}
            onSubmit={(data: CreateCustomerInput) =>
              updateCustomer.mutate({ id: editing.id, ...data }, { onSuccess: () => setEditing(null) })
            }
            isLoading={updateCustomer.isPending}
            onCancel={() => setEditing(null)}
          />
        )}
      </GlassModal>
    </>
  );
}
