"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  type AppointmentInput,
} from "@/lib/api/leads";
import { formatDateTime } from "@/lib/format";
import {
  APPOINTMENT_TYPE_SUGGESTIONS,
  APPOINTMENT_STATUS_SUGGESTIONS,
  appointmentStatusTone,
  suggestionOptions,
} from "@/lib/constants";
import type { LeadAppointment } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
}

/** datetime-local (YYYY-MM-DDTHH:mm, hora local) → ISO; "" si vacío. */
const toIso = (local: string): string => (local ? new Date(local).toISOString() : "");

export function AppointmentsTab({ leadId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listAppointments(leadId, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadAppointment[]>(fetcher, [leadId]);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("VISITA_LOTE");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function reset() {
    setType("VISITA_LOTE");
    setWhen("");
    setLocation("");
    setNotes("");
    setFormErr({});
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!type.trim()) errs.type = "El tipo es obligatorio.";
    if (!when) errs.when = "La fecha/hora es obligatoria.";
    setFormErr(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    const body: AppointmentInput = {
      type: type.trim(),
      scheduled_at: toIso(when),
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      await createAppointment(leadId, body);
      toast({ tone: "success", title: "Cita agendada" });
      setOpen(false);
      reset();
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo agendar", description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(a: LeadAppointment, status: string) {
    try {
      await updateAppointment(a.id, { status });
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo actualizar", description: errorMessage(err) });
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await deleteAppointment(id);
      refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) refetch();
      else toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citas</CardTitle>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => { reset(); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nueva cita
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
          <EmptyState title="Sin citas" description="Aún no hay citas agendadas." />
        ) : (
          <ul className="divide-y divide-border">
            {data!.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{a.type}</span>
                    <Badge tone={appointmentStatusTone(a.status)} dot>{a.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(a.scheduled_at)}
                    {a.location ? ` · ${a.location}` : ""}
                    {a.notes ? ` · ${a.notes}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {canWrite && (
                    <Select
                      options={suggestionOptions(APPOINTMENT_STATUS_SUGGESTIONS, a.status)}
                      value={a.status}
                      onChange={(e) => changeStatus(a, e.target.value)}
                      aria-label="Estado de la cita"
                    />
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={deletingId === a.id}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      aria-label="Eliminar cita"
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
        title="Nueva cita"
        description="El panel no valida solapamientos; revisa la disponibilidad en Agendas."
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="appt-form" size="sm" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner />}
              Agendar
            </Button>
          </>
        }
      >
        <form id="appt-form" onSubmit={create} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo" htmlFor="ap-type" required error={formErr.type}>
              <Select
                id="ap-type"
                options={suggestionOptions(APPOINTMENT_TYPE_SUGGESTIONS, type)}
                value={type}
                onChange={(e) => setType(e.target.value)}
                invalid={!!formErr.type}
              />
            </Field>
            <Field label="Fecha y hora" htmlFor="ap-when" required error={formErr.when}>
              <Input
                id="ap-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                invalid={!!formErr.when}
              />
            </Field>
          </div>
          <Field label="Lugar" htmlFor="ap-loc">
            <Input id="ap-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Km 16 Doble Vía La Guardia" />
          </Field>
          <Field label="Notas" htmlFor="ap-notes">
            <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Viene con su esposo, interesada en tipo C." />
          </Field>
        </form>
      </Dialog>
    </Card>
  );
}
