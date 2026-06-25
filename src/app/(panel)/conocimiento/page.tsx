"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KbEntryForm } from "@/components/kb/kb-entry-form";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listKbEntries, deleteKbEntry, listKbCategories, listKbTags } from "@/lib/api/kb";
import { listProjects } from "@/lib/api/projects";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { BRAND_LABELS, labelFor } from "@/lib/constants";
import type { KbEntry, KbCategory, KbTag, Brand, Paginated, Project } from "@/lib/api/types";

const BRAND_FILTER = [
  { value: "", label: "Todas las marcas" },
  ...(Object.keys(BRAND_LABELS) as Brand[]).map((b) => ({ value: b, label: BRAND_LABELS[b] })),
];
const ACTIVE_FILTER = [
  { value: "", label: "Todos los estados" },
  { value: "true", label: "Activas" },
  { value: "false", label: "Inactivas" },
];

export default function ConocimientoPage() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("kb:write");
  const canDelete = can("kb:delete");

  const catFetcher = useCallback((s?: AbortSignal) => listKbCategories(s), []);
  const { data: categories } = useResource<KbCategory[]>(catFetcher, []);
  const tagFetcher = useCallback((s?: AbortSignal) => listKbTags(s), []);
  const { data: tags } = useResource<KbTag[]>(tagFetcher, []);
  const projFetcher = useCallback(
    (s?: AbortSignal) => listProjects({ page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }, s),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(projFetcher, []);
  const projectOptions = useMemo(
    () => (projectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projectsPage]
  );
  const catName = useMemo(() => {
    const map = new Map((categories ?? []).map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [categories]);

  const list = useList<KbEntry>(listKbEntries, {
    initialSortBy: "priority",
    initialSortOrder: "DESC",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [deleting, setDeleting] = useState<KbEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteKbEntry(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La entrada ya no existe." });
        setDeleting(null);
        list.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<KbEntry>[] = [
    {
      key: "title",
      header: "Título",
      sortKey: "title",
      render: (e) => (
        <div className="max-w-sm">
          <p className="truncate font-medium text-foreground">{e.title}</p>
          <p className="truncate text-xs text-muted">{catName(e.categoryId)}</p>
        </div>
      ),
    },
    {
      key: "brand",
      header: "Marca",
      render: (e) => (e.brand ? <Badge tone="neutral">{labelFor(BRAND_LABELS, e.brand)}</Badge> : <span className="text-muted">—</span>),
    },
    {
      key: "priority",
      header: "Prioridad",
      sortKey: "priority",
      align: "right",
      render: (e) => <span className="text-muted">{e.priority}</span>,
    },
    {
      key: "isActive",
      header: "Estado",
      render: (e) =>
        e.isActive ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="neutral" dot>Inactiva</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) =>
        canWrite || canDelete ? (
          <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
            {canWrite && (
              <button type="button" onClick={() => { setEditing(e); setFormOpen(true); }}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label={`Editar ${e.title}`}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleting(e)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Eliminar ${e.title}`}>
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
        title="Conocimiento"
        description="Base de conocimiento del agente."
        actions={
          <>
            {canWrite && (
              <Button
                variant="secondary"
                onClick={() => router.push("/conocimiento/taxonomia")}
              >
                <Tags className="h-4 w-4" />
                Categorías y etiquetas
              </Button>
            )}
            {canWrite && (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4" />
                Nueva entrada
              </Button>
            )}
          </>
        }
      />

      <div role="group" aria-label="Filtros" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Buscar en título o contenido…" />
        <Select
          options={[{ value: "", label: "Todas las categorías" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={list.filters.categoryId ?? ""}
          onChange={(e) => list.setFilter("categoryId", e.target.value)}
          aria-label="Filtrar por categoría"
        />
        <Select options={BRAND_FILTER} value={list.filters.brand ?? ""}
          onChange={(e) => list.setFilter("brand", e.target.value)} aria-label="Filtrar por marca" />
        <Select options={ACTIVE_FILTER} value={list.filters.isActive ?? ""}
          onChange={(e) => list.setFilter("isActive", e.target.value)} aria-label="Filtrar por estado" />
        <Select
          options={[
            { value: "", label: "Todas las etiquetas" },
            ...(tags ?? []).map((t) => ({ value: t.name, label: t.name })),
          ]}
          value={list.filters.tag ?? ""}
          onChange={(e) => list.setFilter("tag", e.target.value)}
          aria-label="Filtrar por etiqueta"
        />
        <Select
          options={[{ value: "", label: "Todos los proyectos" }, ...projectOptions]}
          value={list.filters.projectId ?? ""}
          onChange={(e) => list.setFilter("projectId", e.target.value)}
          aria-label="Filtrar por proyecto"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(e) => e.id}
          onRowClick={(e) => router.push(`/conocimiento/${e.id}`)}
          rowLabel={(e) => `Ver ${e.title}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin entradas"
          emptyDescription="No hay entradas que coincidan con los filtros."
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <KbEntryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        entry={editing}
        categories={categories ?? []}
        tags={tags ?? []}
        projectOptions={projectOptions}
        canWrite={canWrite}
        onSaved={() => list.refetch()}
        onNotFound={() => list.refetch()}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar "${deleting?.title ?? ""}"`}
        description="La entrada dejará de usarse en el agente."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
