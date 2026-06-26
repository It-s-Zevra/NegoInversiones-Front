"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  SearchX,
  Boxes,
  MapPin,
  Building2,
  CalendarClock,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getProject, deleteProject } from "@/lib/api/projects";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { safeImageUrl } from "@/lib/utils";
import { BRAND_LABELS, UNIT_TYPE_LABELS, labelFor } from "@/lib/constants";
import type { Project } from "@/lib/api/types";

/** Par etiqueta/valor en bloque (label arriba, valor debajo) para una grilla limpia. */
function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canWrite = can("projects:write");
  const canDelete = user?.role === "ADMIN";

  const fetchProject = useCallback(
    (signal?: AbortSignal) => getProject(id, signal),
    [id],
  );
  const {
    data: project,
    loading,
    error,
    refetch,
  } = useResource<Project>(fetchProject, [id]);

  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      const res = await deleteProject(id);
      toast({ tone: "success", title: res.message });
      router.push("/proyectos");
    } catch (err) {
      // 404 idempotente: ya no existe → tratar como éxito y volver al listado.
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El proyecto ya no existe." });
        router.push("/proyectos");
        return;
      }
      toast({
        tone: "error",
        title: "No se pudo eliminar",
        description: errorMessage(err),
      });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Proyectos
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              icon={<SearchX className="h-5 w-5" />}
              title={errorMessage(error)}
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
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : project ? (
        <>
          {/* Cabecera tipo hero: portada (o placeholder) + identidad del proyecto. */}
          <Card className="overflow-hidden p-0">
            <div className="relative h-36 bg-surface-muted sm:h-44">
              {safeImageUrl(project.imgUrl) ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={safeImageUrl(project.imgUrl)!}
                    alt={`Portada de ${project.name}`}
                    className="h-full w-full object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent"
                  />
                </>
              ) : (
                <div
                  aria-hidden
                  className="grid h-full w-full place-items-center text-subtle"
                >
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {project.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="primary">
                    {labelFor(BRAND_LABELS, project.brand)}
                  </Badge>
                  <Badge tone="neutral">
                    {labelFor(UNIT_TYPE_LABELS, project.type)}
                  </Badge>
                  {project.isActive ? (
                    <Badge tone="success" dot>
                      Activo
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      Inactivo
                    </Badge>
                  )}
                </div>
                {(project.city || project.location) && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted">
                    <MapPin className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="truncate">
                      {[project.city, project.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button
                  onClick={() =>
                    router.push(`/proyectos/${project.id}/unidades`)
                  }
                >
                  <Boxes className="h-4 w-4" />
                  Ver unidades
                </Button>
                {canWrite && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(`/proyectos/${project.id}/editar`)
                    }
                  >
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
            </div>
          </Card>

          {/* Tarjetas de resumen rápidas. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3 px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-primary-soft text-primary">
                <Boxes className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Total de unidades
                </p>
                <p className="font-display text-lg font-semibold text-foreground">
                  {formatNumber(project.totalUnits ?? null)}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-surface-muted text-muted">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Tipo
                </p>
                <p className="font-display text-lg font-semibold text-foreground">
                  {labelFor(UNIT_TYPE_LABELS, project.type)}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 px-4 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-surface-muted text-muted">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Creado
                </p>
                <p className="font-display text-lg font-semibold text-foreground">
                  {formatDate(project.createdAt)}
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                <Field label="Ciudad" value={project.city ?? "—"} />
                <Field label="Ubicación" value={project.location ?? "—"} />
                <Field
                  label="Total de unidades"
                  value={formatNumber(project.totalUnits ?? null)}
                />
                <Field
                  label="Última actualización"
                  value={formatDateTime(project.updatedAt)}
                />
                <Field
                  className="sm:col-span-2"
                  label="Descripción"
                  value={
                    project.description ? (
                      <span className="whitespace-pre-line text-muted">
                        {project.description}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                {project.metadata &&
                  Object.keys(project.metadata).length > 0 && (
                    <Field
                      className="sm:col-span-2"
                      label="Información adicional"
                      value={
                        <dl className="flex flex-wrap gap-2">
                          {Object.entries(project.metadata).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface-muted px-2.5 py-1 text-xs"
                            >
                              <dt className="font-medium text-foreground">
                                {k}
                              </dt>
                              <dd className="text-muted">
                                {typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                              </dd>
                            </span>
                          ))}
                        </dl>
                      }
                    />
                  )}
              </dl>
            </CardContent>
          </Card>

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar "${project.name}"`}
            description="El proyecto dejará de aparecer en los listados."
            confirmLabel="Eliminar"
          />
        </>
      ) : null}
    </div>
  );
}
