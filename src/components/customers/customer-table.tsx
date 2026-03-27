"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomerForm } from "./customer-form";
import { useUpdateCustomer, useDeleteCustomer } from "@/hooks/use-customers";
import { Pencil, Trash2, Printer } from "lucide-react";
import type { Customer } from "@/types";
import type { CreateCustomerInput } from "@/validations/customer.schema";
import Link from "next/link";

interface CustomerTableProps {
  customers: Customer[];
  isLoading?: boolean;
  pageOffset?: number;
}

export function CustomerTable({ customers, isLoading, pageOffset = 0 }: CustomerTableProps) {
  const [editing, setEditing] = useState<Customer | null>(null);
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const handlePrint = (c: Customer) => {
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    win.document.write(`
      <html><head><title>Customer Label</title>
      <style>body{font-family:sans-serif;padding:20px}h2{margin:0 0 8px}p{margin:4px 0;font-size:14px}</style>
      </head><body>
      <h2>${c.name}</h2>
      <p>ID: ${c.customerId}</p>
      ${c.phone ? `<p>Phone: ${c.phone}</p>` : ""}
      ${c.city ? `<p>City: ${c.city}</p>` : ""}
      ${c.platform ? `<p>Platform: ${c.platform}</p>` : ""}
      <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `);
    win.document.close();
  };

  const columns: ColumnDef<Customer>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => (
        <span className="text-sm text-t3">{pageOffset + row.index + 1}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "NAME",
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.id}`} className="flex items-center gap-3 hover:opacity-80">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {row.original.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-t1">{row.original.name}</span>
        </Link>
      ),
    },
    {
      accessorKey: "customerId",
      header: "CUSTOMER ID",
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-xs text-t2">
          {row.original.customerId}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "PHONE",
      cell: ({ row }) => <span className="text-sm text-t2">{row.original.phone ?? "—"}</span>,
    },
    {
      accessorKey: "city",
      header: "CITY",
      cell: ({ row }) => <span className="text-sm text-t2">{row.original.city ?? "—"}</span>,
    },
    {
      accessorKey: "platform",
      header: "PLATFORM",
      cell: ({ row }) =>
        row.original.platform ? (
          <span className="inline-flex items-center rounded-full border border-line bg-surface-hover px-2.5 py-0.5 text-xs text-t2">
            {row.original.platform}
          </span>
        ) : (
          <span className="text-sm text-t3">—</span>
        ),
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
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => setEditing(row.original)}
            aria-label="Edit customer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm("Delete this customer?")) deleteCustomer.mutate(row.original.id); }}
            aria-label="Delete customer"
            className="hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </GlassButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={customers} isLoading={isLoading} emptyMessage="No customers found" />

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
