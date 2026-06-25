"use client";

import { useCallback, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import {
  listFollowups,
  createFollowup,
  sendFollowup,
  deleteFollowup,
  type FollowupInput,
} from "@/lib/api/leads";
import { formatDateTime } from "@/lib/format";
import { FOLLOWUP_CHANNEL_LABELS, FOLLOWUP_STATUS_META } from "@/lib/constants";
import type { FollowupChannel, LeadFollowup } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
}

const CHANNELS: FollowupChannel[] = ["WHATSAPP", "WEB", "PANEL", "SISTEMA"];

const toIso = (local: string): string => (local ? new Date(local).toISOString() : "");

export function FollowupsTab({ leadId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listFollowups(leadId, {}, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadFollowup[]>(fetcher, [leadId]);

  const [open, setOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState("0");
  const [when, setWhen] = useState("");
  const [channel, setChannel] = useState<FollowupChannel>("WHATSAPP");
  const [message, setMessage] = useState("");
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reset() {
    setDayOffset("0");
    setWhen("");
    setChannel("WHATSAPP");
    setMessage("");
    setFormErr({});
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const off = Number(dayOffset);
    if (!Number.isInteger(off) || off < 0) errs.dayOffset = "Entero ≥ 0.";
    if (!when) errs.when = "La fecha/hora es obligatoria.";
    setFormErr(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    const body: FollowupInput = {
      day_offset: off,
      scheduled_for: toIso(when),
      message_text: message.trim() || undefined,
      channel,
    };
    try {
      await createFollowup(leadId, body);
      toast({ tone: "success", title: "Followup creado" });
      setOpen(false);
      reset();
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo crear", description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function markSent(f: LeadFollowup) {
    setBusyId(f.id);
    try {
      await sendFollowup(f.id);
      toast({ tone: "success", title: "Marcado como enviado" });
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo marcar", description: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteFollowup(id);
      refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) refetch();
      else toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Followups / seguimientos</CardTitle>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nuevo followup
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="Sin followups" description="Aún no hay seguimientos programados." />
        ) : (
          <ul className="divide-y divide-border">
            {data!.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={FOLLOWUP_STATUS_META[f.status]?.tone ?? "neutral"} dot>
                      {FOLLOWUP_STATUS_META[f.status]?.label ?? f.status}
                    </Badge>
                    <span className="text-xs text-subtle">
                      {FOLLOWUP_CHANNEL_LABELS[f.channel] ?? f.channel} · día {f.day_offset}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(f.scheduled_for)}
                    {f.message_text ? ` · ${f.message_text}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {canWrite && f.status === "PENDIENTE" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => markSent(f)}
                      disabled={busyId === f.id}
                    >
                      <Send className="h-4 w-4" />
                      Enviado
                    </Button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      disabled={busyId === f.id}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label="Eliminar followup"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={open}
        onClose={submitting ? () => {} : () => setOpen(false)}
        title="Nuevo followup"
        description="Programa un recordatorio de seguimiento."
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="fu-form" size="sm" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner />}
              Crear
            </Button>
          </>
        }
      >
        <form id="fu-form" onSubmit={create} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Día (offset)" htmlFor="fu-day" required error={formErr.dayOffset}>
              <Input
                id="fu-day"
                type="number"
                min={0}
                value={dayOffset}
                onChange={(e) => setDayOffset(e.target.value)}
                invalid={!!formErr.dayOffset}
              />
            </Field>
            <Field label="Fecha y hora" htmlFor="fu-when" required error={formErr.when}>
              <Input
                id="fu-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                invalid={!!formErr.when}
              />
            </Field>
            <Field label="Canal" htmlFor="fu-channel">
              <Select
                id="fu-channel"
                options={CHANNELS.map((c) => ({ value: c, label: FOLLOWUP_CHANNEL_LABELS[c] }))}
                value={channel}
                onChange={(e) => setChannel(e.target.value as FollowupChannel)}
              />
            </Field>
          </div>
          <Field label="Mensaje" htmlFor="fu-msg">
            <Textarea
              id="fu-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Recordatorio: ¿le interesó la propuesta?"
            />
          </Field>
        </form>
      </Dialog>
    </Card>
  );
}
