"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/ui/search-input";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadAssignDialog } from "@/components/leads/lead-assign-dialog";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import {
  listLeads,
  leadStats,
  deleteLead,
  restoreLead,
} from "@/lib/api/leads";
import { listProjects } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/users";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatRelativeTime } from "@/lib/format";
import {
  LEAD_STAGE_SUGGESTIONS,
  LEAD_STATUS_SUGGESTIONS,
  LEAD_SOURCE_SUGGESTIONS,
  leadStatusTone,
  suggestionOptions,
} from "@/lib/constants";
import type { Lead, LeadStats, Paginated, Project, User } from "@/lib/api/types";

const VIEW_OPTIONS = [
  { value: "false", label: "Activos" },
  { value: "true", label: "Todos" },
  { value: "only", label: "Papelera" },
];

export default function LeadsPage() {
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();

  const role = user?.role;
  const isManager = role === "ADMIN" || role === "JEFE_COMERCIAL";
  const isAdmin = role === "ADMIN";
  const canWrite =
    can("leads:write") &&
    (role === "ADMIN" || role === "JEFE_COMERCIAL" || role === "EJECUTIVO_VENTAS");
  const canCreate = canWrite;
  const canEdit = canWrite;
  const canAssign = isManager && can("leads:write");
  const canDelete = isAdmin && can("leads:delete");
  const canRestore = isAdmin && can("leads:write");

  // Catálogos para selects y para resolver nombres.
  const fetchProjects = useCallback(
    (s?: AbortSignal) =>
      listProjects({ page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" }, s),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(fetchProjects, []);
  const projects = useMemo(() => projectsPage?.data ?? [], [projectsPage]);
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  const fetchUsers = useCallback(
    (s?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, s),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(fetchUsers, []);
  const users = useMemo(() => usersPage?.data ?? [], [usersPage]);
  const execOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    [users]
  );
  const execName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return (id: string | null) => (id ? (map.get(id) ?? `#${id}`) : "—");
  }, [users]);

  const list = useList<Lead>(listLeads, {
    initialSortBy: "created_at",
    initialSortOrder: "DESC",
    initialFilters: { include_deleted: "false" },
  });
  const view = list.filters.include_deleted ?? "false";
  const isTrash = view === "only";

  // KPIs (respetan el filtro de ejecutivo + rango de fechas).
  const statsFetcher = useCallback(
    (s?: AbortSignal) =>
      leadStats(
        {
          assigned_user_id: list.filters.assigned_user_id || undefined,
          date_from: list.filters.date_from || undefined,
          date_to: list.filters.date_to || undefined,
        },
        s
      ),
    [list.filters.assigned_user_id, list.filters.date_from, list.filters.date_to]
  );
  const { data: stats } = useResource<LeadStats>(statsFetcher, [
    list.filters.assigned_user_id,
    list.filters.date_from,
    list.filters.date_to,
  ]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [assigning, setAssigning] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function clearSelection() {
    setSelected(new Set());
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(lead: Lead) {
    setEditing(lead);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionLoading(true);
    try {
      const res = await deleteLead(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El lead ya no existe." });
        setDeleting(null);
        list.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo bloquear", description: errorMessage(err) });
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function restore(lead: Lead) {
    try {
      await restoreLead(lead.id);
      toast({ tone: "success", title: "Lead restaurado" });
      list.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo restaurar", description: errorMessage(err) });
    }
  }

  const columns: Column<Lead>[] = [
    ...(canAssign && !isTrash
      ? [
          {
            key: "select",
            header: "",
            render: (l: Lead) => (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(l.id)}
                  onCheckedChange={() => toggleSelect(l.id)}
                />
              </div>
            ),
          } as Column<Lead>,
        ]
      : []),
    {
      key: "lead",
      header: "Lead",
      sortKey: "full_name",
      render: (l) => (
        <div>
          <p className="font-medium text-foreground">{l.full_name ?? "—"}</p>
          <p className="text-xs text-muted">{l.phone}</p>
        </div>
      ),
    },
    {
      key: "stage",
      header: "Etapa",
      sortKey: "stage",
      render: (l) => (l.stage ? <Badge tone="neutral">{l.stage}</Badge> : "—"),
    },
    {
      key: "status",
      header: "Estado",
      sortKey: "status",
      render: (l) =>
        l.status ? (
          <Badge tone={leadStatusTone(l.status)} dot>
            {l.status}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      key: "exec",
      header: "Ejecutivo",
      render: (l) => <span className="text-muted">{execName(l.assigned_user_id)}</span>,
    },
    {
      key: "last",
      header: "Último contacto",
      sortKey: "last_contact_at",
      render: (l) => (
        <span className="text-muted">{formatRelativeTime(l.last_contact_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isTrash
            ? canRestore && (
                <button
                  type="button"
                  onClick={() => restore(l)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                  aria-label={`Restaurar ${l.full_name ?? l.phone}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )
            : (
                <>
                  {canAssign && (
                    <button
                      type="button"
                      onClick={() => setAssigning([l.id])}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                      aria-label={`Asignar ${l.full_name ?? l.phone}`}
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEdit(l)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                      aria-label={`Editar ${l.full_name ?? l.phone}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleting(l)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label={`Bloquear ${l.full_name ?? l.phone}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="CRM: busca, califica, agenda y da seguimiento a los contactos."
        actions={
          canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo lead
            </Button>
          )
        }
      />

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-subtle">Total</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
          </Card>
          {Object.entries(stats.byStatus)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, v]) => (
              <Card key={k} className="p-4">
                <p className="truncate text-xs text-subtle">{k}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{v}</p>
              </Card>
            ))}
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <SearchInput
          value={list.search}
          onChange={list.setSearch}
          placeholder="Buscar por nombre, teléfono o email…"
        />
        <div
          role="group"
          aria-label="Filtros"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Field label="Vista" htmlFor="f-view">
            <Select
              id="f-view"
              options={VIEW_OPTIONS}
              value={view}
              onChange={(e) => {
                clearSelection();
                list.setFilter("include_deleted", e.target.value);
              }}
            />
          </Field>
          <Field label="Etapa" htmlFor="f-stage">
            <Select
              id="f-stage"
              options={[
                { value: "", label: "Todas las etapas" },
                ...suggestionOptions(LEAD_STAGE_SUGGESTIONS, list.filters.stage),
              ]}
              value={list.filters.stage ?? ""}
              onChange={(e) => list.setFilter("stage", e.target.value)}
            />
          </Field>
          <Field label="Estado" htmlFor="f-status">
            <Select
              id="f-status"
              options={[
                { value: "", label: "Todos los estados" },
                ...suggestionOptions(LEAD_STATUS_SUGGESTIONS, list.filters.status),
              ]}
              value={list.filters.status ?? ""}
              onChange={(e) => list.setFilter("status", e.target.value)}
            />
          </Field>
          <Field label="Fuente" htmlFor="f-source">
            <Select
              id="f-source"
              options={[
                { value: "", label: "Todas las fuentes" },
                ...suggestionOptions(LEAD_SOURCE_SUGGESTIONS, list.filters.source),
              ]}
              value={list.filters.source ?? ""}
              onChange={(e) => list.setFilter("source", e.target.value)}
            />
          </Field>
          <Field label="Ejecutivo" htmlFor="f-exec">
            <Select
              id="f-exec"
              options={[{ value: "", label: "Todos los ejecutivos" }, ...execOptions]}
              value={list.filters.assigned_user_id ?? ""}
              onChange={(e) => list.setFilter("assigned_user_id", e.target.value)}
            />
          </Field>
          <Field label="Proyecto" htmlFor="f-project">
            <Select
              id="f-project"
              options={[{ value: "", label: "Todos los proyectos" }, ...projectOptions]}
              value={list.filters.project_id ?? ""}
              onChange={(e) => list.setFilter("project_id", e.target.value)}
            />
          </Field>
          <Field label="Desde" htmlFor="f-from">
            <Input
              id="f-from"
              type="date"
              value={list.filters.date_from ?? ""}
              onChange={(e) => list.setFilter("date_from", e.target.value)}
            />
          </Field>
          <Field label="Hasta" htmlFor="f-to">
            <Input
              id="f-to"
              type="date"
              value={list.filters.date_to ?? ""}
              onChange={(e) => list.setFilter("date_to", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Barra de selección masiva */}
      {canAssign && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-2.5">
          <p className="text-sm text-muted">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={clearSelection}>
              Limpiar
            </Button>
            <Button size="sm" onClick={() => setAssigning([...selected])}>
              <UserPlus className="h-4 w-4" />
              Asignar
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          rowKey={(l) => l.id}
          onRowClick={(l) => router.push(`/leads/${l.id}`)}
          rowLabel={(l) => `Ver ${l.full_name ?? l.phone}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle={isTrash ? "Papelera vacía" : "Sin leads"}
          emptyDescription={
            isTrash
              ? "No hay leads bloqueados."
              : "No hay leads que coincidan con los filtros."
          }
          emptyAction={
            canCreate && !isTrash ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nuevo lead
              </Button>
            ) : undefined
          }
          mobileCard={(l) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{l.full_name ?? l.phone}</p>
                <p className="truncate text-xs text-muted">
                  {l.phone} · {execName(l.assigned_user_id)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.stage && <Badge tone="neutral">{l.stage}</Badge>}
                  {l.status && (
                    <Badge tone={leadStatusTone(l.status)} dot>
                      {l.status}
                    </Badge>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {formatDate(l.next_followup_at)}
              </span>
            </div>
          )}
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        lead={editing}
        projectOptions={projectOptions}
        executiveOptions={execOptions}
        onSaved={() => list.refetch()}
        onNotFound={() => list.refetch()}
      />

      <LeadAssignDialog
        open={!!assigning}
        onClose={() => setAssigning(null)}
        leadIds={assigning ?? []}
        executiveOptions={execOptions}
        onAssigned={() => {
          clearSelection();
          list.refetch();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={actionLoading}
        title={`Bloquear lead`}
        description={`${
          deleting?.full_name ?? deleting?.phone ?? ""
        } se moverá a la papelera. Podrás restaurarlo después.`}
        confirmLabel="Bloquear"
      />
    </div>
  );
}
