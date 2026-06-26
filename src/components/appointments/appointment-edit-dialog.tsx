"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { updateAppointment, type AppointmentInput } from "@/lib/api/leads";
import { findExecutiveOverlaps, isOverlapError } from "@/lib/api/appointments";
import { errorMessage } from "@/lib/api/errors";
import {
  APPOINTMENT_TYPE_SUGGESTIONS,
  APPOINTMENT_STATUS_SUGGESTIONS,
  APPOINTMENT_DURATION_OPTIONS,
  APPOINTMENT_OVERLAP_MESSAGE,
  suggestionOptions,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AppointmentCalendarItem } from "@/lib/api/types";

/** Forma mínima que la cita necesita para editarse (calendario o ficha del lead). */
export interface EditableAppointment {
  id: string;
  type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  assigned_user_id: string | null;
  location: string | null;
  notes: string | null;
  lead_name?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  appointment: EditableAppointment | null;
  /** Ejecutivos seleccionables (para reasignar / validar solape). */
  executiveOptions: SelectOption[];
  onSaved: () => void;
}

/** ISO (UTC) → valor de <input datetime-local> en hora local. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local (hora local) → ISO UTC; "" si vacío. */
const toIso = (local: string): string =>
  local ? new Date(local).toISOString() : "";

export function AppointmentEditDialog({
  open,
  onClose,
  appointment,
  executiveOptions,
  onSaved,
}: Props) {
  const toast = useToast();

  // El estado se inicializa desde la cita actual; el componente se remonta por
  // `key={appointment.id}` desde el padre, así que no hace falta un efecto de carga.
  const [type, setType] = useState(() => appointment?.type ?? "");
  const [when, setWhen] = useState(() =>
    appointment ? isoToLocalInput(appointment.scheduled_at) : ""
  );
  const [duration, setDuration] = useState(() =>
    String(appointment?.duration_minutes || 60)
  );
  const [status, setStatus] = useState(() => appointment?.status ?? "AGENDADA");
  const [executive, setExecutive] = useState(
    () => appointment?.assigned_user_id ?? ""
  );
  const [location, setLocation] = useState(() => appointment?.location ?? "");
  const [notes, setNotes] = useState(() => appointment?.notes ?? "");
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Conflictos detectados en el cliente (UX; el 422 del backend es la red real).
  const [conflicts, setConflicts] = useState<AppointmentCalendarItem[]>([]);
  const [checking, setChecking] = useState(false);

  // Pre-chequeo de solape (debounce) cuando cambian ejecutivo / hora / duración.
  const excludeId = appointment?.id;
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
        excludeId,
        signal: controller.signal,
      })
        .then((c) => setConflicts(c))
        .catch(() => {
          /* el pre-chequeo es best-effort; el backend valida igual */
        })
        .finally(() => setChecking(false));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [open, executive, when, duration, excludeId]);

  const typeOptions = useMemo(
    () => suggestionOptions(APPOINTMENT_TYPE_SUGGESTIONS, type),
    [type]
  );
  const statusOptions = useMemo(
    () => suggestionOptions(APPOINTMENT_STATUS_SUGGESTIONS, status),
    [status]
  );
  const durationOptions = useMemo(() => {
    const opts = [...APPOINTMENT_DURATION_OPTIONS];
    if (!opts.some((o) => o.value === duration)) {
      opts.push({ value: duration, label: `${duration} min` });
    }
    return opts;
  }, [duration]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;

    const errs: Record<string, string> = {};
    if (!type.trim()) errs.type = "El tipo es obligatorio.";
    if (!when) errs.when = "La fecha/hora es obligatoria.";
    setFormErr(errs);
    if (Object.keys(errs).length) return;

    // Solo enviamos lo que cambió (PATCH parcial).
    const patch: Partial<AppointmentInput> = {};
    if (type.trim() !== appointment.type) patch.type = type.trim();
    const iso = toIso(when);
    if (iso !== appointment.scheduled_at) patch.scheduled_at = iso;
    const dur = Number(duration) || 60;
    if (dur !== appointment.duration_minutes) patch.duration_minutes = dur;
    if (status !== appointment.status) patch.status = status;
    if ((executive || null) !== appointment.assigned_user_id)
      patch.assigned_user_id = executive || undefined;
    if ((location.trim() || null) !== appointment.location)
      patch.location = location.trim() || undefined;
    if ((notes.trim() || null) !== appointment.notes)
      patch.notes = notes.trim() || undefined;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await updateAppointment(appointment.id, patch);
      toast({ tone: "success", title: "Cita actualizada" });
      onClose();
      onSaved();
    } catch (err) {
      if (isOverlapError(err)) {
        setFormErr((p) => ({ ...p, when: APPOINTMENT_OVERLAP_MESSAGE }));
        toast({ tone: "error", title: APPOINTMENT_OVERLAP_MESSAGE });
      } else {
        toast({
          tone: "error",
          title: "No se pudo actualizar",
          description: errorMessage(err),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Editar cita"
      description={
        appointment?.lead_name ? `Lead: ${appointment.lead_name}` : undefined
      }
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="appt-edit-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id="appt-edit-form" onSubmit={save} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="ae-type" required error={formErr.type}>
            <Select
              id="ae-type"
              options={typeOptions}
              value={type}
              onChange={(e) => setType(e.target.value)}
              invalid={!!formErr.type}
            />
          </Field>
          <Field label="Estado" htmlFor="ae-status">
            <Select
              id="ae-status"
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </Field>
          <Field
            label="Fecha y hora"
            htmlFor="ae-when"
            required
            error={formErr.when}
          >
            <Input
              id="ae-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              invalid={!!formErr.when}
            />
          </Field>
          <Field label="Duración" htmlFor="ae-dur">
            <Select
              id="ae-dur"
              options={durationOptions}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Ejecutivo asignado"
          htmlFor="ae-exec"
          hint="Necesario para validar solapes de agenda."
        >
          <Select
            id="ae-exec"
            options={[{ value: "", label: "Sin asignar" }, ...executiveOptions]}
            value={executive}
            onChange={(e) => setExecutive(e.target.value)}
          />
        </Field>

        {/* Aviso de solape detectado en el cliente */}
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
                <li key={c.appointment_id} className="flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  {formatDateTime(c.scheduled_at)} · {c.type}
                  {c.lead_name ? ` · ${c.lead_name}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4">
          <Field label="Lugar" htmlFor="ae-loc">
            <Input
              id="ae-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Km 16 Doble Vía La Guardia"
            />
          </Field>
          <Field label="Notas" htmlFor="ae-notes">
            <Textarea
              id="ae-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
