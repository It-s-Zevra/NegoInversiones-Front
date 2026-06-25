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
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectForm } from "@/components/projects/project-form";
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">
        {value}
      </dd>
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
    [id]
  );
  const { data: project, loading, error, refetch } = useResource<Project>(
    fetchProject,
    [id]
  );

  const [formOpen, setFormOpen] = useState(false);
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {safeImageUrl(project.imgUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safeImageUrl(project.imgUrl)!}
                  alt={project.name}
                  className="hidden h-16 w-16 rounded-xl object-cover sm:block"
                />
              ) : (
                <div
                  aria-hidden
                  className="hidden h-16 w-16 place-items-center rounded-xl border border-dashed border-border-strong text-subtle sm:grid"
                >
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div>
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => router.push(`/proyectos/${project.id}/unidades`)}
              >
                <Boxes className="h-4 w-4" />
                Ver unidades
              </Button>
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Ciudad" value={project.city ?? "—"} />
                <Row label="Ubicación" value={project.location ?? "—"} />
                <Row
                  label="Total de unidades"
                  value={formatNumber(project.totalUnits ?? null)}
                />
                <Row
                  label="Descripción"
                  value={project.description ?? "—"}
                />
                {project.metadata &&
                  Object.keys(project.metadata).length > 0 && (
                    <Row
                      label="Metadata"
                      value={
                        <div className="flex flex-col gap-0.5 sm:items-end">
                          {Object.entries(project.metadata).map(([k, v]) => (
                            <span key={k} className="text-xs text-muted">
                              <span className="font-medium text-foreground">
                                {k}:
                              </span>{" "}
                              {typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                            </span>
                          ))}
                        </div>
                      }
                    />
                  )}
                <Row label="Creado" value={formatDate(project.createdAt)} />
                <Row
                  label="Última actualización"
                  value={formatDateTime(project.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <ProjectForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            project={project}
            onSaved={() => refetch()}
            onNotFound={() => router.push("/proyectos")}
          />

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
