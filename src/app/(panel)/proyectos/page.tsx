"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectForm } from "@/components/projects/project-form";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useAuth } from "@/lib/auth/auth-context";
import { listProjects, deleteProject } from "@/lib/api/projects";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format";
import { BRAND_LABELS, UNIT_TYPE_LABELS, labelFor } from "@/lib/constants";
import type { Project, Brand, UnitType } from "@/lib/api/types";

const BRAND_FILTER = [
  { value: "", label: "Todas las marcas" },
  ...(Object.keys(BRAND_LABELS) as Brand[]).map((b) => ({
    value: b,
    label: BRAND_LABELS[b],
  })),
];
const TYPE_FILTER = [
  { value: "", label: "Todos los tipos" },
  ...(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => ({
    value: t,
    label: UNIT_TYPE_LABELS[t],
  })),
];
const ACTIVE_FILTER = [
  { value: "", label: "Todos los estados" },
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canWrite = can("projects:write");
  const canDelete = user?.role === "ADMIN"; // el endpoint DELETE es solo ADMIN

  const list = useList<Project>(listProjects, {
    initialSortBy: "createdAt",
    initialSortOrder: "DESC",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(project: Project) {
    setEditing(project);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteProject(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      // 404 idempotente: ya estaba eliminado → tratar como éxito y refrescar.
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El proyecto ya no existe." });
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

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Proyecto",
      sortKey: "name",
      render: (p) => (
        <div>
          <p className="font-medium text-foreground">{p.name}</p>
          <p className="text-xs text-muted">{labelFor(BRAND_LABELS, p.brand)}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      render: (p) => <Badge tone="neutral">{labelFor(UNIT_TYPE_LABELS, p.type)}</Badge>,
    },
    {
      key: "city",
      header: "Ciudad",
      sortKey: "city",
      render: (p) => <span className="text-muted">{p.city ?? "—"}</span>,
    },
    {
      key: "totalUnits",
      header: "Unidades",
      sortKey: "totalUnits",
      align: "right",
      render: (p) => formatNumber(p.totalUnits ?? null),
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
        title="Proyectos"
        description="Loteamientos y viviendas de NegoInversiones."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          )
        }
      />

      {/* Filtros */}
      <div
        role="group"
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          placeholder="Buscar por nombre o ciudad…"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          options={BRAND_FILTER}
          value={list.filters.brand ?? ""}
          onChange={(e) => list.setFilter("brand", e.target.value)}
          aria-label="Filtrar por marca"
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
          onRowClick={(p) => router.push(`/proyectos/${p.id}`)}
          rowLabel={(p) => `Ver ${p.name}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin proyectos"
          emptyDescription="No hay proyectos que coincidan con los filtros."
          emptyAction={
            canWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nuevo proyecto
              </Button>
            ) : undefined
          }
          mobileCard={(p) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {labelFor(BRAND_LABELS, p.brand)} · {p.city ?? "—"}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone="neutral">{labelFor(UNIT_TYPE_LABELS, p.type)}</Badge>
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
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />
            </div>
          )}
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        project={editing}
        onSaved={() => list.refetch()}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar "${deleting?.name ?? ""}"`}
        description="El proyecto dejará de aparecer en los listados."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
