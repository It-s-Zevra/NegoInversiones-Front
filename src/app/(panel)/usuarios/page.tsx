"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserForm } from "@/components/rbac/user-form";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/lib/hooks/use-list";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listUsers, deleteUser } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import type { Role, User } from "@/lib/api/types";

const ACTIVE_FILTER = [
  { value: "", label: "Todos los estados" },
  { value: "true", label: "Activos" },
  { value: "false", label: "Inactivos" },
];

export default function UsuariosPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("users:write");
  const canDelete = can("users:delete");

  const router = useRouter();
  const rolesFetcher = useCallback((s?: AbortSignal) => listRoles(s), []);
  const { data: roles } = useResource<Role[]>(rolesFetcher, []);
  const roleOptions = useMemo(
    () => (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    [roles]
  );
  const roleName = useMemo(() => {
    const map = new Map((roles ?? []).map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? `Rol #${id}`;
  }, [roles]);

  const list = useList<User>(listUsers, {
    initialSortBy: "createdAt",
    initialSortOrder: "DESC",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUser(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      list.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El usuario ya no existe." });
        setDeleting(null);
        list.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "Usuario",
      sortKey: "firstName",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${u.firstName} ${u.lastName}`} src={u.img} className="h-8 w-8 text-[11px]" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {u.firstName} {u.lastName}
            </p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (u) => <Badge tone="neutral">{roleName(u.roleId)}</Badge>,
    },
    {
      key: "department",
      header: "Departamento",
      render: (u) => <span className="text-muted">{u.department ?? "—"}</span>,
    },
    {
      key: "isActive",
      header: "Estado",
      render: (u) =>
        u.isActive ? (
          <Badge tone="success" dot>Activo</Badge>
        ) : (
          <Badge tone="neutral" dot>Inactivo</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) =>
        canWrite || canDelete ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canWrite && (
              <button type="button" onClick={() => { setEditing(u); setFormOpen(true); }}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label={`Editar ${u.firstName}`}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleting(u)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Eliminar ${u.firstName}`}>
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
        title="Usuarios"
        description="Cuentas internas del panel."
        actions={
          canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          )
        }
      />

      <div role="group" aria-label="Filtros" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Buscar por nombre o email…" />
        <Select
          options={[{ value: "", label: "Todos los roles" }, ...roleOptions]}
          value={list.filters.roleId ?? ""}
          onChange={(e) => list.setFilter("roleId", e.target.value)}
          aria-label="Filtrar por rol"
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
          rowKey={(u) => u.id}
          onRowClick={(u) => router.push(`/usuarios/${u.id}`)}
          rowLabel={(u) => `Ver ${u.firstName} ${u.lastName}`}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.toggleSort}
          emptyTitle="Sin usuarios"
          emptyDescription="No hay usuarios que coincidan con los filtros."
        />
        {list.meta && !list.error && (
          <Pagination meta={list.meta} onPageChange={list.setPage} />
        )}
      </Card>

      <UserForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        roleOptions={roleOptions}
        onSaved={() => list.refetch()}
        onNotFound={() => list.refetch()}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar a ${deleting?.firstName ?? ""} ${deleting?.lastName ?? ""}`}
        description="La cuenta dejará de aparecer y no podrá iniciar sesión."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
