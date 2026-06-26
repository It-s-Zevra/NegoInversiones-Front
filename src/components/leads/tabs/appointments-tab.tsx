"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, AlertTriangle, Clock } from "lucide-react";
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
  deleteAppointment,
  updateAppointment,
  type AppointmentInput,
} from "@/lib/api/leads";
import { listUsers } from "@/lib/api/users";
import { findExecutiveOverlaps, isOverlapError } from "@/lib/api/appointments";
import {
  AppointmentEditDialog,
  type EditableAppointment,
} from "@/components/appointments/appointment-edit-dialog";
import { formatDateTime } from "@/lib/format";
import {
  APPOINTMENT_TYPE_SUGGESTIONS,
  APPOINTMENT_STATUS_SUGGESTIONS,
  APPOINTMENT_DURATION_OPTIONS,
  APPOINTMENT_OVERLAP_MESSAGE,
  appointmentStatusTone,
  suggestionOptions,
} from "@/lib/constants";
import type { AppointmentCalendarItem, LeadAppointment, Paginated, User } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
  /** Ejecutivo asignado al lead: pre-selecciona el responsable de la cita. */
  defaultExecutiveId?: string;
}

/** datetime-local (YYYY-MM-DDTHH:mm, hora local) → ISO; "" si vacío. */
const toIso = (local: string): string => (local ? new Date(local).toISOString() : "");

function toEditable(a: LeadAppointment): EditableAppointment {
  return {
    id: a.id,
    type: a.type,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    assigned_user_id: a.assigned_user_id,
    location: a.location,
    notes: a.notes,
  };
}

export function AppointmentsTab({ leadId, canWrite, canDelete, defaultExecutiveId }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listAppointments(leadId, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadAppointment[]>(fetcher, [leadId]);

  // Ejecutivos (para asignar la cita y validar solapes).
  const usersFetcher = useCallback(
    (s?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, s),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(usersFetcher, []);
  const executiveOptions = useMemo(
    () =>
      (usersPage?.data ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    [usersPage]
  );
  const executiveName = useCallback(
    (id: string | null) => executiveOptions.find((o) => o.value === id)?.label ?? null,
    [executiveOptions]
  );

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("VISITA_LOTE");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("60");
  const [executive, setExecutive] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableAppointment | null>(null);

  // Pre-chequeo de solape (best-effort) en el formulario de creación.
  const [conflicts, setConflicts] = useState<AppointmentCalendarItem[]>([]);
  const [checking, setChecking] = useState(false);

  function reset() {
    setType("VISITA_LOTE");
    setWhen("");
    setDuration("60");
    setExecutive(defaultExecutiveId ?? "");
    setLocation("");
    setNotes("");
    setFormErr({});
    setConflicts([]);
  }

  useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      if (!open || !executive || !when) {
        setConflicts([]);
        return;
      }
      setChecking(true);
      findExecutiveOverlaps({
        executiveId: executive,
        scheduledAt: toIso(when),
        durationMinutes: Number(duration) || 60,
        signal: controller.signal,
      })
        .then(setConflicts)
        .catch(() => {})
        .finally(() => setChecking(false));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [open, executive, when, duration]);

  const durationOptions = useMemo(() => {
    const opts = [...APPOINTMENT_DURATION_OPTIONS];
    if (!opts.some((o) => o.value === duration)) opts.push({ value: duration, label: `${duration} min` });
    return opts;
  }, [duration]);

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
      duration_minutes: Number(duration) || 60,
      assigned_user_id: executive || undefined,
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
      if (isOverlapError(err)) {
        setFormErr((p) => ({ ...p, when: APPOINTMENT_OVERLAP_MESSAGE }));
        toast({ tone: "error", title: APPOINTMENT_OVERLAP_MESSAGE });
      } else {
        toast({ tone: "error", title: "No se pudo agendar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(a: LeadAppointment, status: string) {
    try {
      await updateAppointment(a.id, { status });
      refetch();
    } catch (err) {
      if (isOverlapError(err)) {
        toast({ tone: "error", title: APPOINTMENT_OVERLAP_MESSAGE });
      } else {
        toast({ tone: "error", title: "No se pudo actualizar", description: errorMessage(err) });
      }
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
            {data!.map((a) => {
              const exec = executiveName(a.assigned_user_id);
              return (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{a.type}</span>
                      <Badge tone={appointmentStatusTone(a.status)} dot>{a.status}</Badge>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted">
                      <span>{formatDateTime(a.scheduled_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        · <Clock className="h-3 w-3 text-subtle" />{a.duration_minutes} min
                      </span>
                      {exec ? <span>· {exec}</span> : null}
                      {a.location ? <span>· {a.location}</span> : null}
                      {a.notes ? <span>· {a.notes}</span> : null}
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
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setEditing(toEditable(a))}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                        aria-label="Editar cita"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
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
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={open}
        onClose={submitting ? () => {} : () => setOpen(false)}
        title="Nueva cita"
        description="Asigna un ejecutivo para validar la disponibilidad y evitar solapes."
        size="lg"
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
            <Field label="Duración" htmlFor="ap-dur">
              <Select
                id="ap-dur"
                options={durationOptions}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label="Ejecutivo" htmlFor="ap-exec" hint="Necesario para validar solapes.">
              <Select
                id="ap-exec"
                options={[{ value: "", label: "Sin asignar" }, ...executiveOptions]}
                value={executive}
                onChange={(e) => setExecutive(e.target.value)}
              />
            </Field>
          </div>

          {checking ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Spinner /> Verificando disponibilidad…
            </p>
          ) : conflicts.length > 0 ? (
            <div className="space-y-1.5 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                El ejecutivo ya tiene {conflicts.length}{" "}
                {conflicts.length === 1 ? "cita" : "citas"} en ese horario
              </p>
              <ul className="space-y-0.5 pl-6 text-xs">
                {conflicts.slice(0, 3).map((c) => (
                  <li key={c.appointment_id}>
                    {formatDateTime(c.scheduled_at)} · {c.type}
                    {c.lead_name ? ` · ${c.lead_name}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label="Lugar" htmlFor="ap-loc">
            <Input id="ap-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Km 16 Doble Vía La Guardia" />
          </Field>
          <Field label="Notas" htmlFor="ap-notes">
            <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Viene con su esposo, interesada en tipo C." />
          </Field>
        </form>
      </Dialog>

      <AppointmentEditDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        appointment={editing}
        executiveOptions={executiveOptions}
        onSaved={refetch}
      />
    </Card>
  );
}
