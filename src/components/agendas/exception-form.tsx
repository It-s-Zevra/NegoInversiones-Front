"use client";

import { useEffect, useState } from "react";
import { CalendarX2, CalendarPlus, Clock, CalendarRange } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import { createUserException, updateException } from "@/lib/api/schedules";
import { EXCEPTION_TYPE_LABELS, EXCEPTION_EFFECT_LABELS } from "@/lib/constants";
import type {
  AvailabilityException,
  AvailabilityExceptionType,
  AvailabilityExceptionEffect,
} from "@/lib/api/types";

const TYPE_OPTIONS = (
  Object.keys(EXCEPTION_TYPE_LABELS) as AvailabilityExceptionType[]
).map((t) => ({ value: t, label: EXCEPTION_TYPE_LABELS[t] }));
const EFFECT_OPTIONS = (
  Object.keys(EXCEPTION_EFFECT_LABELS) as AvailabilityExceptionEffect[]
).map((e) => ({ value: e, label: EXCEPTION_EFFECT_LABELS[e] }));

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** Si se pasa, el formulario edita esa excepción (PATCH) en vez de crear. */
  exception?: AvailabilityException | null;
  onSaved: () => void;
}

export function ExceptionForm({ open, onClose, userId, exception, onSaved }: Props) {
  const toast = useToast();
  const [type, setType] = useState<AvailabilityExceptionType>("VACACIONES");
  const [effect, setEffect] = useState<AvailabilityExceptionEffect>("BLOQUEA");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset/precarga al abrir
    setErrors({});
    setType(exception?.type ?? "VACACIONES");
    setEffect(exception?.effect ?? "BLOQUEA");
    setStartDate(exception?.startDate?.slice(0, 10) ?? "");
    setEndDate(exception?.endDate?.slice(0, 10) ?? "");
    setIsAllDay(exception?.isAllDay ?? true);
    setStartTime(exception?.startTime?.slice(0, 5) ?? "");
    setEndTime(exception?.endTime?.slice(0, 5) ?? "");
    setReason(exception?.reason ?? "");
    setNotes(exception?.notes ?? "");
  }, [open, exception]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!startDate) next.startDate = "Obligatorio.";
    if (!endDate) next.endDate = "Obligatorio.";
    if (startDate && endDate && endDate < startDate)
      next.endDate = "Debe ser igual o posterior al inicio.";
    if (!isAllDay) {
      if (!startTime) next.startTime = "Obligatorio.";
      if (!endTime) next.endTime = "Obligatorio.";
      if (startTime && endTime && startTime >= endTime)
        next.endTime = "Debe ser posterior al inicio.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    const body = {
      type,
      effect,
      startDate,
      endDate,
      isAllDay,
      ...(isAllDay ? {} : { startTime, endTime }),
      reason: reason.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (exception) {
        await updateException(exception.id, body);
        toast({ tone: "success", title: "Excepción actualizada" });
      } else {
        await createUserException(userId, body);
        toast({ tone: "success", title: "Excepción creada" });
      }
      onSaved();
      onClose();
    } catch (err) {
      if (exception && err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La excepción ya no existe." });
        onSaved();
        onClose();
        return;
      }
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(
          mapValidationErrors(err, ["startDate", "endDate", "startTime", "endTime", "type"]).fieldErrors
        );
      } else if (err instanceof ApiException && err.statusCode === 422) {
        const msg = errorMessage(err);
        if (msg.startsWith("endDate")) {
          setErrors({ endDate: msg });
        } else if (msg.startsWith("Con isAllDay") || msg.startsWith("startTime y endTime")) {
          setErrors({ startTime: "Revisa la franja.", endTime: msg });
        } else if (msg.startsWith("startTime debe ser anterior")) {
          setErrors({ endTime: msg });
        } else {
          toast({ tone: "error", title: msg });
        }
      } else {
        toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const blocks = effect === "BLOQUEA";

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={exception ? "Editar excepción" : "Nueva excepción"}
      description="Marca un día u horario en que la persona no atiende, o suma un horario extra en que sí está disponible."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="exc-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {exception ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="exc-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Qué pasa: efecto BLOQUEA / DISPONIBLE explicado en lenguaje simple */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">¿Qué querés hacer?</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Tipo"
              htmlFor="exc-type"
              required
              hint="Por ejemplo: vacaciones, feriado o licencia médica."
            >
              <Select id="exc-type" options={TYPE_OPTIONS} value={type}
                onChange={(e) => setType(e.target.value as AvailabilityExceptionType)} />
            </Field>
            <Field
              label="Efecto"
              htmlFor="exc-effect"
              hint="Decide si esas fechas cierran o abren la agenda."
            >
              <Select id="exc-effect" options={EFFECT_OPTIONS} value={effect}
                onChange={(e) => setEffect(e.target.value as AvailabilityExceptionEffect)} />
            </Field>
          </div>
          <div
            className={`flex items-start gap-3 rounded-card border px-4 py-3 ${
              blocks
                ? "border-danger/30 bg-danger-soft"
                : "border-success/30 bg-success-soft"
            }`}
          >
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                blocks ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              }`}
              aria-hidden="true"
            >
              {blocks ? <CalendarX2 className="size-4" /> : <CalendarPlus className="size-4" />}
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {blocks ? "Bloquea: la persona NO atiende" : "Disponible: la persona SÍ atiende"}
              </p>
              <p className="text-xs text-muted">
                {blocks
                  ? "En estas fechas no se podrán agendar citas. Sirve para vacaciones, feriados o días libres."
                  : "Suma un horario extra en que sí se puede agendar, aunque normalmente no atienda."}
              </p>
            </div>
          </div>
        </section>

        {/* Cuándo: rango de fechas */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarRange className="size-4 text-subtle" aria-hidden="true" />
            ¿Qué días?
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Desde"
              htmlFor="exc-from"
              required
              error={errors.startDate}
              hint={errors.startDate ? undefined : "Primer día afectado."}
            >
              <Input id="exc-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                invalid={!!errors.startDate} aria-describedby={errors.startDate ? "exc-from-error" : "exc-from-hint"} />
            </Field>
            <Field
              label="Hasta"
              htmlFor="exc-to"
              required
              error={errors.endDate}
              hint={errors.endDate ? undefined : "Último día afectado. Si es un solo día, poné la misma fecha."}
            >
              <Input id="exc-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                invalid={!!errors.endDate} aria-describedby={errors.endDate ? "exc-to-error" : "exc-to-hint"} />
            </Field>
          </div>
        </section>

        {/* Cuándo dentro del día: todo el día u horario */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-subtle" aria-hidden="true" />
            ¿A qué hora?
          </h3>
          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-muted/50 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Todo el día</p>
              <p className="text-xs text-muted">
                {isAllDay
                  ? "Afecta la jornada completa en cada uno de esos días."
                  : "Solo afecta la franja de horas que elijas abajo."}
              </p>
            </div>
            <Switch checked={isAllDay} onCheckedChange={setIsAllDay} aria-label="Todo el día" />
          </div>
          {!isAllDay && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Hora inicio" htmlFor="exc-st" required error={errors.startTime}>
                <Input id="exc-st" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  invalid={!!errors.startTime} aria-describedby={errors.startTime ? "exc-st-error" : undefined} />
              </Field>
              <Field label="Hora fin" htmlFor="exc-et" required error={errors.endTime}>
                <Input id="exc-et" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  invalid={!!errors.endTime} aria-describedby={errors.endTime ? "exc-et-error" : undefined} />
              </Field>
            </div>
          )}
        </section>

        {/* Detalle opcional */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Detalle <span className="font-normal text-subtle">(opcional)</span>
          </h3>
          <Field
            label="Motivo"
            htmlFor="exc-reason"
            hint="Un resumen corto. Por ejemplo: “Viaje familiar”."
          >
            <Input id="exc-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              aria-describedby="exc-reason-hint" />
          </Field>
          <Field
            label="Notas"
            htmlFor="exc-notes"
            hint="Aclaraciones internas que quieras recordar."
          >
            <Textarea id="exc-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              aria-describedby="exc-notes-hint" />
          </Field>
        </section>
      </form>
    </Dialog>
  );
}
