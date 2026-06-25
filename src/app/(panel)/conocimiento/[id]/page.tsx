"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KbEntryForm } from "@/components/kb/kb-entry-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getKbEntry, deleteKbEntry, listKbCategories, listKbTags } from "@/lib/api/kb";
import { listProjects } from "@/lib/api/projects";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { BRAND_LABELS, labelFor } from "@/lib/constants";
import type { KbEntry, KbCategory, KbTag, Paginated, Project } from "@/lib/api/types";

export default function KbDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("kb:write");
  const canDelete = can("kb:delete");

  const fetchEntry = useCallback((s?: AbortSignal) => getKbEntry(id, s), [id]);
  const { data: entry, loading, error, refetch } = useResource<KbEntry>(fetchEntry, [id]);

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

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!entry) return;
    setDeleteLoading(true);
    try {
      const res = await deleteKbEntry(entry.id);
      toast({ tone: "success", title: res.message });
      router.push("/conocimiento");
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La entrada ya no existe." });
        router.push("/conocimiento");
        return;
      }
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/conocimiento" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Conocimiento
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState title={errorMessage(error)} description="Es posible que haya sido eliminada."
              action={<Button variant="secondary" size="sm" onClick={() => router.push("/conocimiento")}>Volver</Button>} />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : entry ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {entry.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {entry.category && <Badge tone="primary">{entry.category.name}</Badge>}
                {entry.brand && <Badge tone="neutral">{labelFor(BRAND_LABELS, entry.brand)}</Badge>}
                {entry.isActive ? <Badge tone="success" dot>Activa</Badge> : <Badge tone="neutral" dot>Inactiva</Badge>}
                {entry.source && <Badge tone="info">{entry.source}</Badge>}
                {entry.hasEmbedding ? (
                  <Badge tone="success">Indexada</Badge>
                ) : (
                  <Badge tone="warning">Indexando…</Badge>
                )}
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
              <CardTitle>Contenido</CardTitle>
              <span className="text-xs text-muted">Prioridad {entry.priority}</span>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {entry.content}
              </p>
              {entry.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {entry.tags.map((t) => (
                    <Badge key={t.id} tone="neutral">#{t.name}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                <span>Creada {formatDate(entry.createdAt)}</span>
                <span>Actualizada {formatDateTime(entry.updatedAt)}</span>
                <span>
                  {entry.hasEmbedding
                    ? `Indexada ${formatDateTime(entry.embeddingUpdatedAt)}`
                    : "Índice del agente en proceso"}
                </span>
              </div>
              {!entry.hasEmbedding && (
                <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-muted">
                  El agente está generando el índice de esta entrada. Puede tardar
                  unos segundos; recarga para ver el estado actualizado.
                </p>
              )}
            </CardContent>
          </Card>

          <KbEntryForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            entry={entry}
            categories={categories ?? []}
            tags={tags ?? []}
            projectOptions={projectOptions}
            canWrite={canWrite}
            onSaved={() => refetch()}
            onNotFound={() => router.push("/conocimiento")}
          />
          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar "${entry.title}"`}
            description="La entrada dejará de usarse en el agente."
            confirmLabel="Eliminar"
          />
        </>
      ) : null}
    </div>
  );
}
