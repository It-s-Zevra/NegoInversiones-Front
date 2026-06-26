"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/states";
import { UnitForm } from "@/components/units/unit-form";
import { CsvImportDialog } from "@/components/ui/csv-import-dialog";
import { projectUnitsImporter } from "@/lib/api/csv-import";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getProject } from "@/lib/api/projects";
import { listProjectUnits, deleteUnit } from "@/lib/api/units";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  UNIT_TYPE_LABELS,
  UNIT_STATUS_META,
  labelFor,
  type BadgeTone,
} from "@/lib/constants";
import type { Project, Unit, UnitStatus, UnitType } from "@/lib/api/types";

const STATUS_FILTER = [
  { value: "", label: "Todos los estados" },
  ...(Object.keys(UNIT_STATUS_META) as UnitStatus[]).map((s) => ({
    value: s,
    label: UNIT_STATUS_META[s].label,
  })),
];
const TYPE_FILTER = [
  { value: "", label: "Todos los tipos" },
  ...(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => ({
    value: t,
    label: UNIT_TYPE_LABELS[t],
  })),
];

function areaLabel(value: string | null): string {
  if (!value) return "—";
  const n = parseFloat(value);
  return Number.isNaN(n) ? "—" : `${formatNumber(n)} m²`;
}

const STATUS_ORDER = Object.keys(UNIT_STATUS_META) as UnitStatus[];

/** Color del punto para cada tono de estado (alineado con los badges). */
const DOT_TONE: Record<BadgeTone, string> = {
  neutral: "bg-muted",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export default function ProjectUnitsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("projects:write");
  const canDelete = can("projects:delete");

  const fetchProject = useCallback(
    (signal?: AbortSignal) => getProject(projectId, signal),
    [projectId]
  );
  const { data: project, error: projectError } = useResource<Project>(
    fetchProject,
    [projectId]
  );

  const list = useList<Unit>(
    (query, signal) => listProjectUnits(projectId, query, signal),
    { initialSortBy: "code", initialSortOrder: "ASC" }
  );

  // Si cambia el proyecto sin desmontar la página, reiniciar filtros/orden/página
  // y recargar (evita arrastrar el estado del proyecto anterior).
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    list.resetFilters();
    list.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const importer = useMemo(() => projectUnitsImporter(projectId), [projectId]);

  // Resumen por estado de las unidades visibles en esta página (datos ya cargados).
  const statusCounts = useMemo(() => {
    const counts = {} as Record<UnitStatus, number>;
    for (const status of STATUS_ORDER) counts[status] = 0;
    for (const unit of list.items) {
      if (unit.status in counts) counts[unit.status] += 1;
    }
    return counts;
  }, [list.items]);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(unit: Unit) {
    setEditing(unit);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUnit(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La unidad ya no existe." });
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

  const columns: Column<Unit>[] = [
    {
      key: "code",
      header: "Unidad",
      sortKey: "code",
      render: (u) => (
        <div className="min-w-0">
          <span className="font-display font-semibold text-foreground">
            {u.code}
          </span>
          <span className="block text-xs text-subtle">
            {labelFor(UNIT_TYPE_LABELS, u.type)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortKey: "status",
      render: (u) => (
        <Badge tone={UNIT_STATUS_META[u.status]?.tone ?? "neutral"} dot>
          {UNIT_STATUS_META[u.status]?.label ?? u.status}
        </Badge>
      ),
    },
    {
      key: "areaM2",
      header: "Área",
      sortKey: "areaM2",
      align: "right",
      render: (u) => (
        <span className="tabular-nums text-muted">{areaLabel(u.areaM2)}</span>
      ),
    },
    {
      key: "price",
      header: "Precio",
      sortKey: "price",
      align: "right",
      render: (u) => (
        <span className="font-display font-semibold tabular-nums text-foreground">
          {formatCurrency(u.price, u.currency)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) =>
        canWrite || canDelete ? (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {canWrite && (
              <button
                type="button"
                onClick={() => openEdit(u)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label={`Editar ${u.code}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleting(u)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Eliminar ${u.code}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null,
    },
  ];

  // Proyecto inexistente.
  if (projectError && projectError.statusCode === 404) {
    return (
      <div className="space-y-6">
        <Link
          href="/proyectos"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Proyectos
        </Link>
        <Card>
          <EmptyState
            title="Proyecto no encontrado"
            description="Es posible que haya sido eliminado."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/proyectos")}
              >
                Volver a proyectos
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/proyectos/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {project ? project.name : "Proyecto"}
      </Link>

      <PageHeader
        title="Unidades"
        description={project ? `Unidades de ${project.name}.` : "Unidades del proyecto."}
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Agregar unidad
              </Button>
            </>
          )
        }
      />

      <div
        role="group"
        aria-label="Filtros"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md"
      >
        <Select
          options={STATUS_FILTER}
          value={list.filters.status ?? ""}
          onChange={(e) => list.setFilter("status", e.target.value)}
          aria-label="Filtrar por estado"
        />
        <Select
          options={TYPE_FILTER}
          value={list.filters.type ?? ""}
          onChange={(e) => list.setFilter("type", e.target.value)}
          aria-label="Filtrar por tipo"
        />
      </div>

      {!list.error && list.items.length > 0 && (
        <div
          role="group"
          aria-label="Resumen por estado en esta página"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {STATUS_ORDER.map((status) => {
            const meta = UNIT_STATUS_META[status];
            return (
              <Card
                key={status}
                className="flex items-center justify-between gap-2 px-3.5 py-3"
              >
                <span className="flex items-center gap-2 text-sm text-muted">
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${DOT_TONE[meta.tone]}`}
                  />
                  {meta.label}
                </span>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {formatNumber(statusCounts[status])}
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(u) => u.id}
          onRowClick={(u) => router.push(`/unidades/${u.id}`)}
          rowLabel={(u) => `Ver unidad ${u.code}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin unidades"
          emptyDescription="Este proyecto aún no tiene unidades que coincidan con los filtros."
          emptyAction={
            canWrite ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Agregar unidad
              </Button>
            ) : undefined
          }
          mobileCard={(u) => (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-foreground">
                    {u.code}
                  </p>
                  <p className="text-xs text-subtle">
                    {labelFor(UNIT_TYPE_LABELS, u.type)} · {areaLabel(u.areaM2)}
                  </p>
                </div>
                <Badge tone={UNIT_STATUS_META[u.status]?.tone ?? "neutral"} dot>
                  {UNIT_STATUS_META[u.status]?.label ?? u.status}
                </Badge>
              </div>
              <span className="font-display text-base font-semibold tabular-nums text-foreground">
                {formatCurrency(u.price, u.currency)}
              </span>
            </div>
          )}
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <UnitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
        unit={editing}
        onSaved={() => list.refetch()}
      />

      {canWrite && (
        <CsvImportDialog
          open={importOpen}
          title="Importar unidades (CSV)"
          importer={importer}
          onClose={() => setImportOpen(false)}
          onImported={() => list.refetch()}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar unidad "${deleting?.code ?? ""}"`}
        description="La unidad dejará de aparecer en el listado."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
