"use client";

import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RoleForm } from "@/components/rbac/role-form";
import { RolePermissionsDialog } from "@/components/rbac/role-permissions-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listRoles, deleteRole } from "@/lib/api/roles";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { ROLE_LABELS, labelFor } from "@/lib/constants";
import type { Role } from "@/lib/api/types";

export default function RolesPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("roles:write");
  const canDelete = can("roles:delete");

  const fetcher = useCallback((s?: AbortSignal) => listRoles(s), []);
  const { data, loading, error, refetch } = useResource<Role[]>(fetcher, []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [permsRole, setPermsRole] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deleteRole(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El rol ya no existe." });
        setDeleting(null);
        refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Rol",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.name}</p>
          <p className="text-xs text-muted">{labelFor(ROLE_LABELS, r.code)}</p>
        </div>
      ),
    },
    {
      key: "code",
      header: "Código",
      render: (r) => <Badge tone="neutral">{r.code}</Badge>,
    },
    {
      key: "description",
      header: "Descripción",
      render: (r) => <span className="text-muted">{r.description ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && (
            <button type="button" onClick={() => setPermsRole(r)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label={`Permisos de ${r.name}`}>
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={() => { setEditing(r); setFormOpen(true); }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label={`Editar ${r.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setDeleting(r)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
              aria-label={`Eliminar ${r.name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Roles del sistema y sus permisos."
        actions={
          canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo rol
            </Button>
          )
        }
      />

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={loading}
          error={error}
          onRetry={refetch}
          rowKey={(r) => r.id}
          emptyTitle="Sin roles"
        />
      </Card>

      <RoleForm open={formOpen} onClose={() => setFormOpen(false)} role={editing} onSaved={refetch} onNotFound={refetch} />
      <RolePermissionsDialog
        open={!!permsRole}
        roleId={permsRole?.id ?? null}
        roleName={permsRole?.name ?? ""}
        onClose={() => setPermsRole(null)}
        onSaved={refetch}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar "${deleting?.name ?? ""}"`}
        description="El rol dejará de estar disponible."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
