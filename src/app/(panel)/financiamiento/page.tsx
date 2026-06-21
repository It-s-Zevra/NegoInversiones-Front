"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FinancingPlanForm } from "@/components/financing/financing-plan-form";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useAuth } from "@/lib/auth/auth-context";
import { listFinancingPlans, deleteFinancingPlan } from "@/lib/api/financing";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format";
import { FINANCING_TYPE_LABELS, FREQUENCY_LABELS, labelFor } from "@/lib/constants";
import type { FinancingPlan, FinancingPlanType } from "@/lib/api/types";

const TYPE_FILTER = [
  { value: "", label: "Todos los tipos" },
  ...(Object.keys(FINANCING_TYPE_LABELS) as FinancingPlanType[]).map((t) => ({
    value: t,
    label: FINANCING_TYPE_LABELS[t],
  })),
];
const ACTIVE_FILTER = [
  { value: "", label: "Todos los estados" },
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

function pct(value: string | null): string {
  if (value == null) return "—";
  const n = parseFloat(value);
  return Number.isNaN(n) ? "—" : `${formatNumber(n)}%`;
}

export default function FinancingPage() {
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canWrite = can("financing-plans:write");
  const canDelete = user?.role === "ADMIN"; // delete es solo ADMIN

  const list = useList<FinancingPlan>(listFinancingPlans, {
    initialSortBy: "createdAt",
    initialSortOrder: "DESC",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancingPlan | null>(null);
  const [deleting, setDeleting] = useState<FinancingPlan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(plan: FinancingPlan) {
    setEditing(plan);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteFinancingPlan(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El plan ya no existe." });
        setDeleting(null);
        list.refetch();
      } else {
        toast({
          tone: "error",
          title: "No se pudo eliminar",
          description: errorMessage(err),
        });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<FinancingPlan>[] = [
    {
      key: "name",
      header: "Plan",
      sortKey: "name",
      render: (p) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-foreground">{p.name}</p>
          {p.description && (
            <p className="truncate text-xs text-muted">{p.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      sortKey: "type",
      render: (p) => <Badge tone="neutral">{labelFor(FINANCING_TYPE_LABELS, p.type)}</Badge>,
    },
    {
      key: "installments",
      header: "Cuotas",
      render: (p) => (
        <span className="text-muted">
          {p.installmentsCount != null
            ? `${formatNumber(p.installmentsCount)} × ${labelFor(FREQUENCY_LABELS, p.frequency)}`
            : "—"}
        </span>
      ),
    },
    {
      key: "interestRate",
      header: "Interés",
      align: "right",
      render: (p) => <span className="text-muted">{pct(p.interestRate)}</span>,
    },
    {
      key: "isActive",
      header: "Estado",
      render: (p) =>
        p.isActive ? (
          <Badge tone="success" dot>
            Activo
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Inactivo
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) =>
        canWrite || canDelete ? (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {canWrite && (
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label={`Editar ${p.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleting(p)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Eliminar ${p.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financiamiento"
        description="Catálogo de planes de financiamiento."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo plan
            </Button>
          )
        }
      />

      <div
        role="group"
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          placeholder="Buscar por nombre o descripción…"
        />
        <Select
          options={TYPE_FILTER}
          value={list.filters.type ?? ""}
          onChange={(e) => list.setFilter("type", e.target.value)}
          aria-label="Filtrar por tipo"
        />
        <Select
          options={ACTIVE_FILTER}
          value={list.filters.isActive ?? ""}
          onChange={(e) => list.setFilter("isActive", e.target.value)}
          aria-label="Filtrar por estado"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/financiamiento/${p.id}`)}
          rowLabel={(p) => `Ver ${p.name}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin planes"
          emptyDescription="No hay planes que coincidan con los filtros."
          emptyAction={
            canWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nuevo plan
              </Button>
            ) : undefined
          }
          mobileCard={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {labelFor(FINANCING_TYPE_LABELS, p.type)} · interés {pct(p.interestRate)}
                </p>
                <div className="mt-1.5">
                  {p.isActive ? (
                    <Badge tone="success" dot>
                      Activo
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      Inactivo
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <FinancingPlanForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        plan={editing}
        onSaved={() => list.refetch()}
        onNotFound={() => list.refetch()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar "${deleting?.name ?? ""}"`}
        description="El plan dejará de aparecer en el catálogo."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
