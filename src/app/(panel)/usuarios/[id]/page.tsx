"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Building2,
  Clock,
  CalendarPlus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
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

/** Línea de contacto con acción directa (mailto:/tel:) o valor plano. */
function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-surface-muted text-subtle">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-subtle">{label}</p>
        {value && href ? (
          <a
            href={href}
            className="block truncate text-sm font-medium text-primary hover:text-primary-hover hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{value ?? "—"}</p>
        )}
      </div>
    </div>
  );
}

/** Tile de dato (label arriba, valor abajo) para metadatos. */
function MetaTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-surface-muted p-4">
      <div className="flex items-center gap-1.5 text-subtle">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-medium text-foreground">{value}</p>
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
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <Card>
            <CardContent className="space-y-3 pt-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
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
                className="h-16 w-16 text-lg"
              />
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {user.firstName} {user.lastName}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="primary">
                    <ShieldCheck className="h-3 w-3" />
                    {roleName(user.roleId)}
                  </Badge>
                  {user.isActive ? (
                    <Badge tone="success" dot>Activo</Badge>
                  ) : (
                    <Badge tone="danger" dot>Inactivo</Badge>
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
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactRow
                icon={Mail}
                label="Email"
                value={user.email}
                href={`mailto:${user.email}`}
              />
              <ContactRow
                icon={Phone}
                label="Teléfono"
                value={user.phone}
                href={user.phone ? `tel:${user.phone}` : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MetaTile
                  icon={Building2}
                  label="Departamento"
                  value={user.department ?? "—"}
                />
                <MetaTile
                  icon={Clock}
                  label="Último acceso"
                  value={formatDateTime(user.lastLoginAt)}
                />
                <MetaTile
                  icon={CalendarPlus}
                  label="Creado"
                  value={formatDate(user.createdAt)}
                />
                <MetaTile
                  icon={RefreshCw}
                  label="Última actualización"
                  value={formatDateTime(user.updatedAt)}
                />
              </div>
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
