"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserForm } from "@/components/rbac/user-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getUser, deleteUser } from "@/lib/api/users";
import { listRoles } from "@/lib/api/roles";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Role, User } from "@/lib/api/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">{value}</dd>
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can, user: me } = useAuth();
  const isAdmin = me?.role === "ADMIN";
  const canWrite = isAdmin && can("users:write");
  const canDelete = isAdmin && can("users:delete");

  const fetchUser = useCallback((s?: AbortSignal) => getUser(id, s), [id]);
  const { data: user, loading, error, refetch } = useResource<User>(fetchUser, [id]);

  const rolesFetcher = useCallback((s?: AbortSignal) => listRoles(s), []);
  const { data: roles } = useResource<Role[]>(rolesFetcher, []);
  const roleOptions = useMemo(
    () => (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    [roles]
  );
  const roleName = (rid: string) =>
    (roles ?? []).find((r) => r.id === rid)?.name ?? `Rol #${rid}`;

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!user) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUser(user.id);
      toast({ tone: "success", title: res.message });
      router.push("/usuarios");
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        router.push("/usuarios");
        return;
      }
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Usuarios
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-48" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              title={errorMessage(error)}
              description="Es posible que haya sido eliminado."
              action={
                <Button variant="secondary" size="sm" onClick={() => router.push("/usuarios")}>
                  Volver a usuarios
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : user ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                src={user.img}
                name={`${user.firstName} ${user.lastName}`}
                className="h-14 w-14"
              />
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {user.firstName} {user.lastName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{roleName(user.roleId)}</Badge>
                  {user.isActive ? (
                    <Badge tone="success" dot>Activo</Badge>
                  ) : (
                    <Badge tone="neutral" dot>Inactivo</Badge>
                  )}
                </div>
              </div>
            </div>

            {(canWrite || canDelete) && (
              <div className="flex items-center gap-2">
                {canWrite && (
                  <Button variant="secondary" onClick={() => setFormOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                    <span className="text-danger">Eliminar</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Email" value={user.email} />
                <Row label="Teléfono" value={user.phone ?? "—"} />
                <Row label="Rol" value={roleName(user.roleId)} />
                <Row label="Departamento" value={user.department ?? "—"} />
                <Row label="Último acceso" value={formatDateTime(user.lastLoginAt)} />
                <Row label="Creado" value={formatDate(user.createdAt)} />
                <Row label="Última actualización" value={formatDateTime(user.updatedAt)} />
              </dl>
            </CardContent>
          </Card>

          <UserForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            user={user}
            roleOptions={roleOptions}
            onSaved={() => refetch()}
            onNotFound={() => router.push("/usuarios")}
          />

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar a ${user.firstName} ${user.lastName}`}
            description="La cuenta dejará de aparecer y no podrá iniciar sesión."
            confirmLabel="Eliminar"
          />
        </>
      ) : null}
    </div>
  );
}
