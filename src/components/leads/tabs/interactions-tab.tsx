"use client";

import { useCallback, useMemo, useState } from "react";
import { Send, Trash2, StickyNote, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { LeadInteraction } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
}

type Kind = "note" | "inbound" | "outbound" | "system";

function classify(it: LeadInteraction): Kind {
  if (it.message_type === "NOTE") return "note";
  if (it.direction === "INBOUND") return "inbound";
  if (it.direction === "OUTBOUND") return "outbound";
  return "system";
}

/** Quién originó la interacción, en lenguaje simple. */
function actorLabel(it: LeadInteraction, kind: Kind): string {
  if (kind === "inbound") return "Cliente";
  if (it.handled_by === "AGENT") return "Agente IA";
  if (kind === "outbound") return "Equipo";
  return "Sistema";
}

const ts = (it: LeadInteraction) => Date.parse(it.occurred_at ?? it.created_at) || 0;

export function InteractionsTab({ leadId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listInteractions(leadId, {}, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadInteraction[]>(fetcher, [leadId]);

  // Más reciente arriba (feed de actividad).
  const items = useMemo(() => [...(data ?? [])].sort((a, b) => ts(b) - ts(a)), [data]);

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
      if (err instanceof ApiException && err.statusCode === 404) refetch();
      else toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  }

  function DeleteBtn({ id }: { id: string }) {
    if (!canDelete) return null;
    return (
      <button
        type="button"
        onClick={() => remove(id)}
        disabled={deletingId === id}
        className="opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
        aria-label="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  function Media({ url }: { url: string | null }) {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Ver adjunto
      </a>
    );
  }

  function renderItem(it: LeadInteraction) {
    const kind = classify(it);
    const who = actorLabel(it, kind);
    const when = formatDateTime(it.occurred_at ?? it.created_at);

    // Nota interna: bloque centrado, distinto de la conversación.
    if (kind === "note") {
      return (
        <li key={it.id} className="group flex justify-center">
          <div className="w-full max-w-[92%] rounded-xl border border-warning/30 bg-warning-soft/40 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                <StickyNote className="h-3.5 w-3.5" />
                Nota interna
              </span>
              <DeleteBtn id={it.id} />
            </div>
            {it.message_text && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {it.message_text}
              </p>
            )}
            <p className="mt-1 text-[11px] text-subtle">{when}</p>
          </div>
        </li>
      );
    }

    const isInbound = kind === "inbound";
    return (
      <li
        key={it.id}
        className={cn("group flex", isInbound ? "justify-start" : "justify-end")}
      >
        <div className={cn("max-w-[82%] min-w-0", !isInbound && "items-end")}>
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5",
              isInbound
                ? "rounded-tl-sm border border-border bg-surface-muted"
                : "rounded-tr-sm bg-primary-soft"
            )}
          >
            {it.message_text ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{it.message_text}</p>
            ) : (
              <p className="text-sm italic text-muted">(sin texto)</p>
            )}
            <Media url={it.media_url} />
          </div>
          <div
            className={cn(
              "mt-1 flex items-center gap-2 px-1 text-[11px] text-subtle",
              !isInbound && "justify-end"
            )}
          >
            <span className="font-medium text-muted">{who}</span>
            <span>· {when}</span>
            {it.channel === "WHATSAPP" && <span>· WhatsApp</span>}
            {it.intent && (
              <span className="rounded bg-info-soft px-1.5 py-0.5 text-info">
                {it.intent}
              </span>
            )}
            <DeleteBtn id={it.id} />
          </div>
        </div>
      </li>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Conversación</CardTitle>
          <p className="mt-0.5 text-xs text-muted">
            Mensajes de WhatsApp del cliente y notas internas del equipo.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agregar nota interna */}
        {canWrite && (
          <form onSubmit={addNote} className="rounded-xl border border-border bg-surface-muted/30 p-3">
            <label
              htmlFor="new-note"
              className="text-xs font-medium text-foreground"
            >
              Agregar nota interna
            </label>
            <Textarea
              id="new-note"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Anota algo del cliente o del seguimiento…"
              className="mt-1.5"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-subtle">
                Solo la ve el equipo · no se envía al cliente.
              </p>
              <Button type="submit" size="sm" disabled={submitting || !text.trim()} aria-busy={submitting}>
                {submitting ? <Spinner /> : <Send className="h-4 w-4" />}
                Agregar nota
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-12 w-1/2 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin conversación todavía"
            description="Aquí verás los mensajes de WhatsApp y las notas que agregues."
          />
        ) : (
          <ul className="space-y-3">{items.map(renderItem)}</ul>
        )}
      </CardContent>
    </Card>
  );
}
