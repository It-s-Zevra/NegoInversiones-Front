"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createLead,
  updateLead,
  type CreateLeadInput,
  type UpdateLeadInput,
} from "@/lib/api/leads";
import { listProjectUnits } from "@/lib/api/units";
import {
  LEAD_STAGE_SUGGESTIONS,
  LEAD_STATUS_SUGGESTIONS,
  LEAD_SOURCE_SUGGESTIONS,
  LEAD_INTENT_SUGGESTIONS,
  LEAD_STATUS_SIDE_EFFECTS,
  suggestionOptions,
} from "@/lib/constants";
import type { Lead, Unit, Paginated } from "@/lib/api/types";

interface LeadFormState {
  phone: string;
  full_name: string;
  email: string;
  source: string;
  stage: string;
  status: string;
  intent: string;
  score: string;
  assigned_user_id: string;
  project_id: string;
  project_unit_id: string;
  notes: string;
}

const emptyForm: LeadFormState = {
  phone: "",
  full_name: "",
  email: "",
  source: "PANEL",
  stage: "NUEVO",
  status: "ACTIVO",
  intent: "",
  score: "",
  assigned_user_id: "",
  project_id: "",
  project_unit_id: "",
  notes: "",
};

function numOrUndef(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

/** Encabezado de sección dentro de la Card del formulario. */
function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-0.5">
      <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

interface LeadFormProps {
  lead?: Lead | null;
  projectOptions: SelectOption[];
  executiveOptions: SelectOption[];
  onSaved: (lead: Lead) => void;
  onCancel: () => void;
  onNotFound?: () => void;
}

export function LeadForm({
  lead,
  projectOptions,
  executiveOptions,
  onSaved,
  onCancel,
  onNotFound,
}: LeadFormProps) {
  const toast = useToast();
  const isEdit = !!lead;

  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmSideEffect, setConfirmSideEffect] = useState(false);

  // Unidades del proyecto elegido (selector dependiente).
  const projectId = form.project_id;
  const unitsFetcher = useCallback(
    (signal?: AbortSignal) =>
      projectId
        ? listProjectUnits(
            projectId,
            { page: 1, limit: 100, sortBy: "code", sortOrder: "ASC" },
            signal
          )
        : Promise.resolve(null),
    [projectId]
  );
  const unitsRes = useResource<Paginated<Unit> | null>(unitsFetcher, [projectId]);
  const unitOptions = useMemo<SelectOption[]>(() => {
    const opts = (unitsRes.data?.data ?? []).map((u) => ({
      value: u.id,
      label: u.code,
    }));
    if (
      lead?.project_unit_id &&
      !opts.some((o) => o.value === lead.project_unit_id)
    ) {
      opts.push({
        value: lead.project_unit_id,
        label: `Unidad #${lead.project_unit_id}`,
      });
    }
    return opts;
  }, [unitsRes.data, lead]);

  const resolvedProjectOptions = useMemo(() => {
    if (lead?.project_id && !projectOptions.some((o) => o.value === lead.project_id)) {
      return [
        ...projectOptions,
        { value: lead.project_id, label: `Proyecto #${lead.project_id}` },
      ];
    }
    return projectOptions;
  }, [projectOptions, lead]);

  const resolvedExecOptions = useMemo(() => {
    if (
      lead?.assigned_user_id &&
      !executiveOptions.some((o) => o.value === lead.assigned_user_id)
    ) {
      return [
        ...executiveOptions,
        { value: lead.assigned_user_id, label: `Ejecutivo #${lead.assigned_user_id}` },
      ];
    }
    return executiveOptions;
  }, [executiveOptions, lead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al montar/cambiar de entidad
    setErrors({});
    setConfirmSideEffect(false);
    setForm(
      lead
        ? {
            phone: lead.phone,
            full_name: lead.full_name ?? "",
            email: lead.email ?? "",
            source: lead.source ?? "",
            stage: lead.stage ?? "",
            status: lead.status ?? "",
            intent: lead.intent ?? "",
            score: lead.score?.toString() ?? "",
            assigned_user_id: lead.assigned_user_id ?? "",
            project_id: lead.project_id ?? "",
            project_unit_id: lead.project_unit_id ?? "",
            notes: lead.notes ?? "",
          }
        : emptyForm
    );
  }, [lead]);

  function set<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onProjectChange(value: string) {
    // Al cambiar de proyecto la unidad anterior deja de ser válida.
    setForm((f) => ({ ...f, project_id: value, project_unit_id: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!isEdit && !form.phone.trim()) next.phone = "El teléfono es obligatorio.";
    if (form.score.trim() !== "") {
      const n = Number(form.score);
      if (Number.isNaN(n)) next.score = "Debe ser un número.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const sideEffectTriggered = useMemo(() => {
    const target = form.status.trim();
    if (!LEAD_STATUS_SIDE_EFFECTS.has(target)) return false;
    // Solo confirmar si es nuevo o si el status cambió respecto al original.
    return !isEdit || target !== (lead?.status ?? "");
  }, [form.status, isEdit, lead]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (sideEffectTriggered && !confirmSideEffect) {
      setConfirmSideEffect(true);
      return;
    }
    await doSave();
  }

  async function doSave() {
    setConfirmSideEffect(false);
    setSubmitting(true);

    // Interés: si hay unidad elegida se envía project_unit_id (el backend limpia
    // project_id); si no, se envía project_id. Mutuamente excluyentes.
    const interest = form.project_unit_id.trim()
      ? { project_unit_id: form.project_unit_id.trim() }
      : form.project_id.trim()
        ? { project_id: form.project_id.trim() }
        : {};

    try {
      let saved: Lead;
      if (isEdit) {
        const body: UpdateLeadInput = {
          full_name: form.full_name.trim() || undefined,
          email: form.email.trim() || undefined,
          source: form.source.trim() || undefined,
          stage: form.stage.trim() || undefined,
          status: form.status.trim() || undefined,
          intent: form.intent.trim() || undefined,
          score: numOrUndef(form.score),
          notes: form.notes.trim() || undefined,
          assigned_user_id: form.assigned_user_id.trim() || undefined,
          ...interest,
        };
        saved = await updateLead(lead!.id, body);
      } else {
        const body: CreateLeadInput = {
          phone: form.phone.trim(),
          full_name: form.full_name.trim() || undefined,
          email: form.email.trim() || undefined,
          source: form.source.trim() || undefined,
          stage: form.stage.trim() || undefined,
          status: form.status.trim() || undefined,
          assigned_user_id: form.assigned_user_id.trim() || undefined,
          notes: form.notes.trim() || undefined,
          ...interest,
        };
        saved = await createLead(body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Lead actualizado" : "Lead creado",
        description: sideEffectTriggered
          ? "Se notificó al equipo (auto-asignación + reporte IA)."
          : saved.full_name || saved.phone,
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        const { fieldErrors, rest } = mapValidationErrors(
          err,
          Object.keys(emptyForm)
        );
        setErrors(fieldErrors);
        toast({
          tone: "error",
          title: "Revisa los campos del formulario",
          description: rest.length ? rest.join(" ") : undefined,
        });
      } else if (err instanceof ApiException && err.statusCode === 409) {
        setErrors({ phone: err.messages[0] ?? "Teléfono duplicado." });
        toast({ tone: "error", title: errorMessage(err) });
      } else if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: errorMessage(err) });
        onNotFound?.();
      } else {
        toast({
          tone: "error",
          title: "No se pudo guardar",
          description: errorMessage(err),
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const unitPlaceholder = !form.project_id
    ? "Elegí un proyecto primero"
    : unitsRes.loading
      ? "Cargando unidades…"
      : "Sin unidad";

  return (
    <>
      <form id="lead-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card>
          <CardContent className="space-y-8 p-5 sm:p-6">
            {/* Contacto */}
            <section className="space-y-4">
              <SectionTitle
                title="Contacto"
                description="Datos básicos para identificar y comunicarte con el lead."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Teléfono"
                  htmlFor="l-phone"
                  required={!isEdit}
                  error={errors.phone}
                  hint={isEdit ? "No se puede cambiar tras crear." : "Clave de contacto."}
                >
                  <Input
                    id="l-phone"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    invalid={!!errors.phone}
                    disabled={isEdit}
                    placeholder="+59171234567"
                  />
                </Field>
                <Field label="Nombre" htmlFor="l-name" error={errors.full_name}>
                  <Input
                    id="l-name"
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Juan Pérez"
                  />
                </Field>
                <Field label="Email" htmlFor="l-email" error={errors.email}>
                  <Input
                    id="l-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="juan@email.com"
                  />
                </Field>
                <Field label="Fuente" htmlFor="l-source">
                  <Select
                    id="l-source"
                    options={suggestionOptions(LEAD_SOURCE_SUGGESTIONS, form.source)}
                    placeholder="Sin fuente"
                    value={form.source}
                    onChange={(e) => set("source", e.target.value)}
                  />
                </Field>
              </div>
            </section>

            {/* Clasificación */}
            <section className="space-y-4 border-t border-border pt-8">
              <SectionTitle
                title="Clasificación"
                description="Etapa, estado e intención para ubicar el lead en el embudo."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Etapa" htmlFor="l-stage">
                  <Select
                    id="l-stage"
                    options={suggestionOptions(LEAD_STAGE_SUGGESTIONS, form.stage)}
                    placeholder="Sin etapa"
                    value={form.stage}
                    onChange={(e) => set("stage", e.target.value)}
                  />
                </Field>
                <Field
                  label="Estado"
                  htmlFor="l-status"
                  hint={
                    sideEffectTriggered
                      ? "Notifica al equipo y dispara reporte IA."
                      : undefined
                  }
                >
                  <Select
                    id="l-status"
                    options={suggestionOptions(LEAD_STATUS_SUGGESTIONS, form.status)}
                    placeholder="Sin estado"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                  />
                </Field>
                {isEdit ? (
                  <Field label="Score" htmlFor="l-score" error={errors.score}>
                    <Input
                      id="l-score"
                      type="number"
                      value={form.score}
                      onChange={(e) => set("score", e.target.value)}
                      invalid={!!errors.score}
                      placeholder="85"
                    />
                  </Field>
                ) : (
                  <Field label="Intención" htmlFor="l-intent">
                    <Select
                      id="l-intent"
                      options={suggestionOptions(LEAD_INTENT_SUGGESTIONS, form.intent)}
                      placeholder="Sin intención"
                      value={form.intent}
                      onChange={(e) => set("intent", e.target.value)}
                    />
                  </Field>
                )}
              </div>
            </section>

            {/* Asignación e interés */}
            <section className="space-y-4 border-t border-border pt-8">
              <SectionTitle
                title="Asignación e interés"
                description="Ejecutivo responsable y el proyecto o unidad que le interesa."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Ejecutivo" htmlFor="l-exec">
                  <Select
                    id="l-exec"
                    options={resolvedExecOptions}
                    placeholder="Sin asignar"
                    value={form.assigned_user_id}
                    onChange={(e) => set("assigned_user_id", e.target.value)}
                  />
                </Field>
                <Field label="Proyecto de interés" htmlFor="l-project">
                  <Select
                    id="l-project"
                    options={resolvedProjectOptions}
                    placeholder="Sin proyecto"
                    value={form.project_id}
                    onChange={(e) => onProjectChange(e.target.value)}
                  />
                </Field>
                <Field
                  label="Unidad de interés"
                  htmlFor="l-unit"
                  hint="Excluyente con el proyecto."
                >
                  <Select
                    id="l-unit"
                    options={unitOptions}
                    placeholder={unitPlaceholder}
                    value={form.project_unit_id}
                    onChange={(e) => set("project_unit_id", e.target.value)}
                    disabled={!form.project_id}
                  />
                </Field>
              </div>
            </section>

            {/* Notas */}
            <section className="space-y-4 border-t border-border pt-8">
              <SectionTitle
                title="Notas"
                description="Contexto libre que ayude al seguimiento."
              />
              <Field label="Notas" htmlFor="l-notes">
                <Textarea
                  id="l-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Llamar el lunes, interesado en tipo C."
                />
              </Field>
            </section>
          </CardContent>
        </Card>

        {/* Barra de acción fija abajo, cómoda en móvil */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-app/85 px-1 py-3 backdrop-blur">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar cambios" : "Crear lead"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmSideEffect}
        onClose={() => setConfirmSideEffect(false)}
        onConfirm={doSave}
        loading={submitting}
        tone="primary"
        title={`Marcar como ${form.status}`}
        description="El backend auto-asignará un ejecutivo (si no tiene), generará un reporte IA y notificará al equipo. ¿Continuar?"
        confirmLabel="Sí, continuar"
      />
    </>
  );
}
