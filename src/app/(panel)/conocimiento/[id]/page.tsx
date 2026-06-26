"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getKbEntry, deleteKbEntry } from "@/lib/api/kb";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { BRAND_LABELS, labelFor } from "@/lib/constants";
import type { KbEntry } from "@/lib/api/types";

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
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card>
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-9/12" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4 pt-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          </div>
        </div>
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
                {entry.hasEmbedding ? (
                  <Badge tone="success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Indexada
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Indexando…
                  </Badge>
                )}
              </div>
            </div>
            {(canWrite || canDelete) && (
              <div className="flex items-center gap-2">
                {canWrite && (
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/conocimiento/${entry.id}/editar`)}
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
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            {/* Columna de lectura principal */}
            <Card>
              <CardHeader>
                <CardTitle>Contenido</CardTitle>
                <span className="text-xs text-muted">
                  Esto es lo que usa el agente para responder.
                </span>
              </CardHeader>
              <CardContent>
                {entry.content.trim() ? (
                  <p className="max-w-prose whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-foreground">
                    {entry.content}
                  </p>
                ) : (
                  <p className="text-sm text-subtle">
                    Esta entrada todavía no tiene contenido.
                  </p>
                )}

                {entry.mediaUrls && entry.mediaUrls.length > 0 && (
                  <div className="mt-6 border-t border-border pt-5">
                    <h2 className="text-sm font-medium text-foreground">Adjuntos</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {entry.mediaUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block overflow-hidden rounded-card border border-border bg-surface-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Adjunto de la entrada"
                            className="aspect-square w-full object-cover transition group-hover:opacity-90"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sidebar de metadatos */}
            <Card className="lg:sticky lg:top-6">
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <dl className="space-y-3.5">
                  <div>
                    <dt className="text-xs text-subtle">Categoría</dt>
                    <dd className="mt-1 text-foreground">
                      {entry.category ? entry.category.name : "Sin categoría"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Marca</dt>
                    <dd className="mt-1 text-foreground">
                      {entry.brand
                        ? labelFor(BRAND_LABELS, entry.brand)
                        : "Todas"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Prioridad</dt>
                    <dd className="mt-1 text-foreground">{entry.priority}</dd>
                  </div>
                  {entry.source && (
                    <div>
                      <dt className="text-xs text-subtle">Origen</dt>
                      <dd className="mt-1 text-foreground">{entry.source}</dd>
                    </div>
                  )}
                </dl>

                <div className="border-t border-border pt-4">
                  <dt className="text-xs text-subtle">Estado del índice</dt>
                  <dd className="mt-1.5">
                    {entry.hasEmbedding ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Lista para el agente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-warning">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando índice
                      </span>
                    )}
                  </dd>
                  <p className="mt-2 text-xs leading-relaxed text-subtle">
                    {entry.hasEmbedding
                      ? `Indexada el ${formatDateTime(entry.embeddingUpdatedAt)}.`
                      : "El agente está procesando esta entrada. Puede tardar unos segundos; recarga para ver el estado actualizado."}
                  </p>
                </div>

                {entry.tags.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <dt className="text-xs text-subtle">Etiquetas</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {entry.tags.map((t) => (
                        <Badge key={t.id} tone="neutral">#{t.name}</Badge>
                      ))}
                    </dd>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <dl className="space-y-2.5 text-xs text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-subtle">Creada</dt>
                      <dd className="text-right text-foreground">
                        {formatDate(entry.createdAt)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-subtle">Actualizada</dt>
                      <dd className="text-right text-foreground">
                        {formatDateTime(entry.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>
          </div>

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
