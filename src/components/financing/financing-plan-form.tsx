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
import {
  createFinancingPlan,
  updateFinancingPlan,
  type CreateFinancingPlanInput,
  type UpdateFinancingPlanInput,
} from "@/lib/api/financing";
import {
  FINANCING_TYPE_LABELS,
  DOWN_PAYMENT_TYPE_LABELS,
  FREQUENCY_LABELS,
} from "@/lib/constants";
import type {
  FinancingPlan,
  FinancingPlanType,
  DownPaymentType,
  InstallmentFrequency,
} from "@/lib/api/types";

const TYPE_OPTIONS = (
  Object.keys(FINANCING_TYPE_LABELS) as FinancingPlanType[]
).map((t) => ({ value: t, label: FINANCING_TYPE_LABELS[t] }));
const DP_OPTIONS = (
  Object.keys(DOWN_PAYMENT_TYPE_LABELS) as DownPaymentType[]
).map((t) => ({ value: t, label: DOWN_PAYMENT_TYPE_LABELS[t] }));
const FREQ_OPTIONS = (
  Object.keys(FREQUENCY_LABELS) as InstallmentFrequency[]
).map((t) => ({ value: t, label: FREQUENCY_LABELS[t] }));

interface PlanFormState {
  name: string;
  type: FinancingPlanType;
  description: string;
  currency: string;
  downPaymentType: DownPaymentType;
  downPaymentRequired: string;
  downPaymentPercent: string;
  installmentsCount: string;
  installmentAmount: string;
  frequency: InstallmentFrequency;
  termMonths: string;
  interestRate: string;
  cashDiscountPercent: string;
  minAmount: string;
  isActive: boolean;
}

const emptyForm: PlanFormState = {
  name: "",
  type: "CREDITO_DIRECTO",
  description: "",
  currency: "USD",
  downPaymentType: "NONE",
  downPaymentRequired: "",
  downPaymentPercent: "",
  installmentsCount: "",
  installmentAmount: "",
  frequency: "MENSUAL",
  termMonths: "",
  interestRate: "",
  cashDiscountPercent: "",
  minAmount: "",
  isActive: true,
};

function numOrUndef(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  plan?: FinancingPlan | null;
  onSaved: (plan: FinancingPlan) => void;
  onNotFound?: () => void;
}

export function FinancingPlanForm({
  open,
  onClose,
  plan,
  onSaved,
  onNotFound,
}: PlanFormProps) {
  const toast = useToast();
  const isEdit = !!plan;

  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario al abrir
    setErrors({});
    setForm(
      plan
        ? {
            name: plan.name,
            type: plan.type,
            description: plan.description ?? "",
            currency: plan.currency ?? "USD",
            downPaymentType: plan.downPaymentType,
            downPaymentRequired: plan.downPaymentRequired ?? "",
            downPaymentPercent: plan.downPaymentPercent ?? "",
            installmentsCount: plan.installmentsCount?.toString() ?? "",
            installmentAmount: plan.installmentAmount ?? "",
            frequency: plan.frequency,
            termMonths: plan.termMonths?.toString() ?? "",
            interestRate: plan.interestRate ?? "",
            cashDiscountPercent: plan.cashDiscountPercent ?? "",
            minAmount: plan.minAmount ?? "",
            isActive: plan.isActive,
          }
        : emptyForm
    );
  }, [open, plan]);

  function set<K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    if (form.currency.trim() !== "" && form.currency.trim().length !== 3)
      next.currency = "La moneda debe tener 3 letras.";

    const nonNeg: (keyof PlanFormState)[] = [
      "installmentAmount",
      "interestRate",
      "minAmount",
    ];
    for (const key of nonNeg) {
      const v = form[key] as string;
      if (v.trim() !== "") {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0) next[key] = "Debe ser un número ≥ 0.";
      }
    }
    const pct: (keyof PlanFormState)[] = ["cashDiscountPercent"];
    for (const key of pct) {
      const v = form[key] as string;
      if (v.trim() !== "") {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > 100)
          next[key] = "Debe estar entre 0 y 100.";
      }
    }
    // Solo validar el campo de anticipo visible según el tipo.
    if (form.downPaymentType === "FIXED" && form.downPaymentRequired.trim() !== "") {
      const n = Number(form.downPaymentRequired);
      if (Number.isNaN(n) || n < 0)
        next.downPaymentRequired = "Debe ser un número ≥ 0.";
    }
    if (form.downPaymentType === "PERCENT" && form.downPaymentPercent.trim() !== "") {
      const n = Number(form.downPaymentPercent);
      if (Number.isNaN(n) || n < 0 || n > 100)
        next.downPaymentPercent = "Debe estar entre 0 y 100.";
    }
    for (const key of ["installmentsCount", "termMonths"] as const) {
      const v = form[key];
      if (v.trim() !== "") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) next[key] = "Entero ≥ 0.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // En edición, poner en 0 el campo de anticipo que ya no aplica para que el
    // backend no conserve un valor incoherente (el contrato no valida coherencia).
    const dpFields =
      form.downPaymentType === "FIXED"
        ? {
            downPaymentRequired: numOrUndef(form.downPaymentRequired),
            ...(isEdit ? { downPaymentPercent: 0 } : {}),
          }
        : form.downPaymentType === "PERCENT"
          ? {
              downPaymentPercent: numOrUndef(form.downPaymentPercent),
              ...(isEdit ? { downPaymentRequired: 0 } : {}),
            }
          : isEdit
            ? { downPaymentRequired: 0, downPaymentPercent: 0 }
            : {};

    const common = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency.trim() || undefined,
      downPaymentType: form.downPaymentType,
      frequency: form.frequency,
      ...dpFields,
      installmentsCount: numOrUndef(form.installmentsCount),
      installmentAmount: numOrUndef(form.installmentAmount),
      termMonths: numOrUndef(form.termMonths),
      interestRate: numOrUndef(form.interestRate),
      cashDiscountPercent: numOrUndef(form.cashDiscountPercent),
      minAmount: numOrUndef(form.minAmount),
    };

    setSubmitting(true);
    try {
      let saved: FinancingPlan;
      if (isEdit) {
        const body: UpdateFinancingPlanInput = {
          ...common,
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
          isActive: form.isActive,
        };
        saved = await updateFinancingPlan(plan!.id, body);
      } else {
        const body: CreateFinancingPlanInput = {
          ...common,
          description: form.description.trim() || undefined,
        };
        saved = await createFinancingPlan(body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Plan actualizado" : "Plan creado",
        description: saved.name,
      });
      onSaved(saved);
      onClose();
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
      } else if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: errorMessage(err) });
        onClose();
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

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar plan" : "Nuevo plan de financiamiento"}
      description={
        isEdit
          ? "Actualiza las condiciones del plan."
          : "Crea una modalidad de financiamiento."
      }
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
            form="plan-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            {isEdit ? "Guardar cambios" : "Crear plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nombre" htmlFor="fp-name" required error={errors.name}>
          <Input
            id="fp-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "fp-name-error" : undefined}
            placeholder="Crédito directo 6 años"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="fp-type" required error={errors.type}>
            <Select
              id="fp-type"
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={(e) => set("type", e.target.value as FinancingPlanType)}
              invalid={!!errors.type}
              aria-describedby={errors.type ? "fp-type-error" : undefined}
            />
          </Field>
          <Field label="Moneda" htmlFor="fp-currency" error={errors.currency}>
            <Input
              id="fp-currency"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              invalid={!!errors.currency}
              aria-describedby={errors.currency ? "fp-currency-error" : undefined}
              placeholder="USD"
            />
          </Field>
        </div>

        <Field label="Descripción" htmlFor="fp-desc">
          <Textarea
            id="fp-desc"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A sola firma, sin aval. Cuota fija mensual."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Tipo de anticipo"
            htmlFor="fp-dptype"
            error={errors.downPaymentType}
            hint="Cómo se cobra la cuota inicial: sin anticipo, un monto fijo, o un % del precio."
          >
            <Select
              id="fp-dptype"
              options={DP_OPTIONS}
              value={form.downPaymentType}
              invalid={!!errors.downPaymentType}
              aria-describedby={
                errors.downPaymentType ? "fp-dptype-error" : "fp-dptype-hint"
              }
              onChange={(e) => {
                const dpt = e.target.value as DownPaymentType;
                setForm((f) => ({
                  ...f,
                  downPaymentType: dpt,
                  downPaymentRequired:
                    dpt === "FIXED" ? f.downPaymentRequired : "",
                  downPaymentPercent:
                    dpt === "PERCENT" ? f.downPaymentPercent : "",
                }));
                setErrors((prev) => {
                  const rest = { ...prev };
                  delete rest.downPaymentRequired;
                  delete rest.downPaymentPercent;
                  return rest;
                });
              }}
            />
          </Field>
          {form.downPaymentType === "FIXED" && (
            <Field
              label="Anticipo (monto)"
              htmlFor="fp-dpreq"
              error={errors.downPaymentRequired}
            >
              <Input
                id="fp-dpreq"
                type="number"
                min={0}
                step="0.01"
                value={form.downPaymentRequired}
                onChange={(e) => set("downPaymentRequired", e.target.value)}
                invalid={!!errors.downPaymentRequired}
                aria-describedby={
                  errors.downPaymentRequired ? "fp-dpreq-error" : undefined
                }
                placeholder="200"
              />
            </Field>
          )}
          {form.downPaymentType === "PERCENT" && (
            <Field
              label="Anticipo (%)"
              htmlFor="fp-dppct"
              error={errors.downPaymentPercent}
            >
              <Input
                id="fp-dppct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.downPaymentPercent}
                onChange={(e) => set("downPaymentPercent", e.target.value)}
                invalid={!!errors.downPaymentPercent}
                aria-describedby={
                  errors.downPaymentPercent ? "fp-dppct-error" : undefined
                }
                placeholder="10"
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nº de cuotas" htmlFor="fp-count" error={errors.installmentsCount}>
            <Input
              id="fp-count"
              type="number"
              min={0}
              value={form.installmentsCount}
              onChange={(e) => set("installmentsCount", e.target.value)}
              invalid={!!errors.installmentsCount}
              aria-describedby={
                errors.installmentsCount ? "fp-count-error" : undefined
              }
              placeholder="72"
            />
          </Field>
          <Field
            label="Monto de cuota"
            htmlFor="fp-amount"
            error={errors.installmentAmount}
          >
            <Input
              id="fp-amount"
              type="number"
              min={0}
              step="0.01"
              value={form.installmentAmount}
              onChange={(e) => set("installmentAmount", e.target.value)}
              invalid={!!errors.installmentAmount}
              aria-describedby={
                errors.installmentAmount ? "fp-amount-error" : undefined
              }
              placeholder="515"
            />
          </Field>
          <Field label="Frecuencia" htmlFor="fp-freq" error={errors.frequency}>
            <Select
              id="fp-freq"
              options={FREQ_OPTIONS}
              value={form.frequency}
              onChange={(e) =>
                set("frequency", e.target.value as InstallmentFrequency)
              }
              invalid={!!errors.frequency}
              aria-describedby={errors.frequency ? "fp-freq-error" : undefined}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Plazo (meses)" htmlFor="fp-term" error={errors.termMonths}>
            <Input
              id="fp-term"
              type="number"
              min={0}
              value={form.termMonths}
              onChange={(e) => set("termMonths", e.target.value)}
              invalid={!!errors.termMonths}
              aria-describedby={errors.termMonths ? "fp-term-error" : undefined}
              placeholder="72"
            />
          </Field>
          <Field
            label="Tasa de interés (%)"
            htmlFor="fp-rate"
            error={errors.interestRate}
            hint="Tasa anual. Pon 0 si el plan no cobra interés."
          >
            <Input
              id="fp-rate"
              type="number"
              min={0}
              step="0.01"
              value={form.interestRate}
              onChange={(e) => set("interestRate", e.target.value)}
              invalid={!!errors.interestRate}
              aria-describedby={errors.interestRate ? "fp-rate-error" : "fp-rate-hint"}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Descuento al contado (%)"
            htmlFor="fp-disc"
            error={errors.cashDiscountPercent}
            hint="Descuento si el cliente paga todo de una vez."
          >
            <Input
              id="fp-disc"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.cashDiscountPercent}
              onChange={(e) => set("cashDiscountPercent", e.target.value)}
              invalid={!!errors.cashDiscountPercent}
              aria-describedby={
                errors.cashDiscountPercent ? "fp-disc-error" : "fp-disc-hint"
              }
              placeholder="50"
            />
          </Field>
          <Field
            label="Monto mínimo"
            htmlFor="fp-min"
            error={errors.minAmount}
            hint="Monto mínimo de la operación para poder usar este plan."
          >
            <Input
              id="fp-min"
              type="number"
              min={0}
              step="0.01"
              value={form.minAmount}
              onChange={(e) => set("minAmount", e.target.value)}
              invalid={!!errors.minAmount}
              aria-describedby={errors.minAmount ? "fp-min-error" : "fp-min-hint"}
              placeholder="1"
            />
          </Field>
        </div>

        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Plan activo</p>
              <p className="text-xs text-muted">
                Los inactivos no se ofrecen ni se asocian a unidades.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              aria-label="Plan activo"
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}
