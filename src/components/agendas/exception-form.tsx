"use client";

import { useEffect, useState } from "react";
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
import { createUserException } from "@/lib/api/schedules";
import { EXCEPTION_TYPE_LABELS, EXCEPTION_EFFECT_LABELS } from "@/lib/constants";
import type {
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
  onSaved: () => void;
}

export function ExceptionForm({ open, onClose, userId, onSaved }: Props) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir
    setErrors({});
    setType("VACACIONES");
    setEffect("BLOQUEA");
    setStartDate("");
    setEndDate("");
    setIsAllDay(true);
    setStartTime("");
    setEndTime("");
    setReason("");
    setNotes("");
  }, [open]);

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
    try {
      await createUserException(userId, {
        type,
        effect,
        startDate,
        endDate,
        isAllDay,
        ...(isAllDay ? {} : { startTime, endTime }),
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast({ tone: "success", title: "Excepción creada" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(
          mapValidationErrors(err, ["startDate", "endDate", "startTime", "endTime", "type"]).fieldErrors
        );
      } else if (err instanceof ApiException && err.statusCode === 422) {
        const msg = errorMessage(err);
        if (msg.startsWith("endDate")) {
          setErrors({ endDate: msg });
        } else if (msg.startsWith("startTime y endTime")) {
          setErrors({ startTime: "Obligatorio.", endTime: msg });
        } else if (msg.startsWith("startTime debe ser anterior")) {
          setErrors({ endTime: msg });
        } else {
          toast({ tone: "error", title: msg });
        }
      } else {
        toast({ tone: "error", title: "No se pudo crear", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Nueva excepción"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="exc-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            Crear
          </Button>
        </>
      }
    >
      <form id="exc-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="exc-type" required>
            <Select id="exc-type" options={TYPE_OPTIONS} value={type}
              onChange={(e) => setType(e.target.value as AvailabilityExceptionType)} />
          </Field>
          <Field label="Efecto" htmlFor="exc-effect">
            <Select id="exc-effect" options={EFFECT_OPTIONS} value={effect}
              onChange={(e) => setEffect(e.target.value as AvailabilityExceptionEffect)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Desde" htmlFor="exc-from" required error={errors.startDate}>
            <Input id="exc-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              invalid={!!errors.startDate} aria-describedby={errors.startDate ? "exc-from-error" : undefined} />
          </Field>
          <Field label="Hasta" htmlFor="exc-to" required error={errors.endDate}>
            <Input id="exc-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              invalid={!!errors.endDate} aria-describedby={errors.endDate ? "exc-to-error" : undefined} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Todo el día</p>
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
        <Field label="Motivo" htmlFor="exc-reason">
          <Input id="exc-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Notas" htmlFor="exc-notes">
          <Textarea id="exc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
