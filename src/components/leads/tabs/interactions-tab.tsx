"use client";

import { useCallback, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import {
  listInteractions,
  createInteraction,
  deleteInteraction,
} from "@/lib/api/leads";
import { formatDateTime } from "@/lib/format";
import type { LeadInteraction } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
}

export function InteractionsTab({ leadId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listInteractions(leadId, {}, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadInteraction[]>(fetcher, [leadId]);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await createInteraction(leadId, { message_text: text.trim(), message_type: "NOTE" });
      setText("");
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo guardar la nota", description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await deleteInteraction(id);
      refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interacciones y notas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <form onSubmit={addNote} className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe una nota interna…"
              aria-label="Nueva nota"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting || !text.trim()} aria-busy={submitting}>
                {submitting ? <Spinner /> : <Send className="h-4 w-4" />}
                Agregar nota
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="Sin interacciones" description="Aún no hay mensajes ni notas." />
        ) : (
          <ul className="space-y-3">
            {data!.map((it) => (
              <li key={it.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {it.channel && <Badge tone="neutral">{it.channel}</Badge>}
                    {it.direction && <Badge tone={it.direction === "INBOUND" ? "info" : "primary"}>{it.direction}</Badge>}
                    {it.message_type && <span className="text-xs text-subtle">{it.message_type}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">{formatDateTime(it.occurred_at ?? it.created_at)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        disabled={deletingId === it.id}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label="Eliminar interacción"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {it.message_text && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{it.message_text}</p>
                )}
                {it.handled_by && (
                  <p className="mt-1 text-xs text-subtle">por {it.handled_by}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
