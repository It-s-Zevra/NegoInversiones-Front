"use client";

import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PermissionForm } from "@/components/rbac/permission-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listPermissions, deletePermission } from "@/lib/api/permissions";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import type { Permission } from "@/lib/api/types";

export default function PermisosPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("permissions:write");
  const canDelete = can("permissions:delete");

  const fetcher = useCallback((s?: AbortSignal) => listPermissions(s), []);
  const { data, loading, error, refetch } = useResource<Permission[]>(fetcher, []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [deleting, setDeleting] = useState<Permission | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await deletePermission(deleting.id);
      toast({ tone: "success", title: res.message });
      setDeleting(null);
      refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El permiso ya no existe." });
        setDeleting(null);
        refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Permission>[] = [
    {
      key: "code",
      header: "Código",
      render: (p) => <Badge tone="primary">{p.code}</Badge>,
    },
    {
      key: "name",
      header: "Nombre",
      render: (p) => <span className="font-medium text-foreground">{p.name}</span>,
    },
    {
      key: "description",
      header: "Descripción",
      render: (p) => <span className="text-muted">{p.description ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) =>
        canWrite || canDelete ? (
          <div className="flex items-center justify-end gap-1">
            {canWrite && (
              <button type="button" onClick={() => { setEditing(p); setFormOpen(true); }}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label={`Editar ${p.code}`}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleting(p)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Eliminar ${p.code}`}>
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
        title="Permisos"
        description="Catálogo de permisos finos del sistema."
        actions={
          canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo permiso
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
          rowKey={(p) => p.id}
          emptyTitle="Sin permisos"
        />
      </Card>

      <PermissionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        permission={editing}
        onSaved={refetch}
        onNotFound={refetch}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title={`Eliminar "${deleting?.code ?? ""}"`}
        description="El permiso se quitará de todos los roles que lo tengan."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
