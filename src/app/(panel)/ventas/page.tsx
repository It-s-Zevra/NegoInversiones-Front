"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SaleForm } from "@/components/sales/sale-form";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listSales, deleteSale } from "@/lib/api/sales";
import { listProjects } from "@/lib/api/projects";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { SALE_STATUS_META } from "@/lib/constants";
import type { Paginated, Project, Sale, SaleStatus } from "@/lib/api/types";

const STATUS_FILTER = [
  { value: "", label: "Todos los estados" },
  ...(Object.keys(SALE_STATUS_META) as SaleStatus[]).map((s) => ({
    value: s,
    label: SALE_STATUS_META[s].label,
  })),
];

export default function SalesPage() {
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canCreate = can("sales:write");
  const isManager = user?.role === "ADMIN" || user?.role === "JEFE_COMERCIAL";
  const canManage = isManager && can("sales:write"); // editar/eliminar: solo ADMIN/JEFE_COMERCIAL

  // Proyectos para el selector y para resolver nombres en la tabla.
  const fetchProjects = useCallback(
    (signal?: AbortSignal) =>
      listProjects(
        { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" },
        signal
      ),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(
    fetchProjects,
    []
  );
  const projects = useMemo(() => projectsPage?.data ?? [], [projectsPage]);
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );
  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? `Proyecto #${id}`;
  }, [projects]);

  const list = useList<Sale>(listSales, {
    initialSortBy: "createdAt",
    initialSortOrder: "DESC",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(sale: Sale) {
    setEditing(sale);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteSale(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La venta ya no existe." });
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

  const columns: Column<Sale>[] = [
    {
      key: "id",
      header: "Venta",
      render: (s) => (
        <div>
          <p className="font-medium text-foreground">#{s.id}</p>
          <p className="text-xs text-muted">Lead {s.leadId}</p>
        </div>
      ),
    },
    {
      key: "project",
      header: "Proyecto",
      render: (s) => <span className="text-muted">{projectName(s.projectId)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      sortKey: "status",
      render: (s) => (
        <Badge tone={SALE_STATUS_META[s.status]?.tone ?? "neutral"} dot>
          {SALE_STATUS_META[s.status]?.label ?? s.status}
        </Badge>
      ),
    },
    {
      key: "contractDate",
      header: "Contrato",
      sortKey: "contractDate",
      render: (s) => <span className="text-muted">{formatDate(s.contractDate)}</span>,
    },
    {
      key: "totalPrice",
      header: "Monto",
      sortKey: "totalPrice",
      align: "right",
      render: (s) => formatCurrency(s.totalPrice, s.currency),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) =>
        canManage ? (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => openEdit(s)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label={`Editar venta #${s.id}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(s)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
              aria-label={`Eliminar venta #${s.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        description="Historial de ventas de NegoInversiones."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Registrar venta
            </Button>
          )
        }
      />

      <div
        role="group"
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field label="Estado" htmlFor="f-status">
          <Select
            id="f-status"
            options={STATUS_FILTER}
            value={list.filters.status ?? ""}
            onChange={(e) => list.setFilter("status", e.target.value)}
          />
        </Field>
        <Field label="Lead" htmlFor="f-lead">
          <Input
            id="f-lead"
            inputMode="numeric"
            value={list.filters.leadId ?? ""}
            onChange={(e) => list.setFilter("leadId", e.target.value)}
            placeholder="ID del lead"
          />
        </Field>
        <Field label="Proyecto" htmlFor="f-project">
          <Select
            id="f-project"
            options={[
              { value: "", label: "Todos los proyectos" },
              ...projectOptions,
            ]}
            value={list.filters.projectId ?? ""}
            onChange={(e) => list.setFilter("projectId", e.target.value)}
          />
        </Field>
        <Field label="Ejecutivo" htmlFor="f-exec">
          <Input
            id="f-exec"
            inputMode="numeric"
            value={list.filters.executiveId ?? ""}
            onChange={(e) => list.setFilter("executiveId", e.target.value)}
            placeholder="ID del ejecutivo"
          />
        </Field>
        <Field label="Contrato desde" htmlFor="f-from">
          <Input
            id="f-from"
            type="date"
            value={list.filters.contractDateFrom ?? ""}
            onChange={(e) => list.setFilter("contractDateFrom", e.target.value)}
          />
        </Field>
        <Field label="Contrato hasta" htmlFor="f-to">
          <Input
            id="f-to"
            type="date"
            value={list.filters.contractDateTo ?? ""}
            onChange={(e) => list.setFilter("contractDateTo", e.target.value)}
          />
        </Field>
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(s) => s.id}
          onRowClick={(s) => router.push(`/ventas/${s.id}`)}
          rowLabel={(s) => `Ver venta #${s.id}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin ventas"
          emptyDescription="No hay ventas que coincidan con los filtros."
          emptyAction={
            canCreate ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Registrar venta
              </Button>
            ) : undefined
          }
          mobileCard={(s) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">#{s.id}</p>
                <p className="truncate text-xs text-muted">
                  {projectName(s.projectId)} · {formatDate(s.contractDate)}
                </p>
                <div className="mt-1.5">
                  <Badge tone={SALE_STATUS_META[s.status]?.tone ?? "neutral"} dot>
                    {SALE_STATUS_META[s.status]?.label ?? s.status}
                  </Badge>
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">
                {formatCurrency(s.totalPrice, s.currency)}
              </span>
            </div>
          )}
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <SaleForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        sale={editing}
        projectOptions={projectOptions}
        onSaved={() => list.refetch()}
        onNotFound={() => list.refetch()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar venta #${deleting?.id ?? ""}`}
        description="La venta dejará de aparecer en el historial."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
