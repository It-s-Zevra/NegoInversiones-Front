"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createSale,
  updateSale,
  type CreateSaleInput,
  type UpdateSaleInput,
} from "@/lib/api/sales";
import { listUsers } from "@/lib/api/users";
import { listProjectUnits } from "@/lib/api/units";
import { SALE_STATUS_META } from "@/lib/constants";
import type { Sale, SaleStatus, User, Unit, Paginated } from "@/lib/api/types";

const STATUS_OPTIONS = (Object.keys(SALE_STATUS_META) as SaleStatus[]).map(
  (s) => ({ value: s, label: SALE_STATUS_META[s].label })
);

interface SaleFormState {
  leadId: string;
  projectId: string;
  unitId: string;
  executiveId: string;
  status: SaleStatus;
  totalPrice: string;
  currency: string;
  downPayment: string;
  contractDate: string;
  financingTermMonths: string;
  interestRate: string;
  agreements: string;
}

const emptyForm: SaleFormState = {
  leadId: "",
  projectId: "",
  unitId: "",
  executiveId: "",
  status: "EN_PROCESO",
  totalPrice: "",
  currency: "USD",
  downPayment: "",
  contractDate: "",
  financingTermMonths: "",
  interestRate: "",
  agreements: "",
};

function numOrUndef(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

/** Asocia el mensaje 422 de FK con su campo del formulario. */
function fkField(message: string): keyof SaleFormState | null {
  const low = message.toLowerCase();
  if (low.includes("lead")) return "leadId";
  if (low.includes("proyecto")) return "projectId";
  if (low.includes("unidad")) return "unitId";
  if (low.includes("ejecutivo")) return "executiveId";
  return null;
}

interface SaleFormProps {
  open: boolean;
  onClose: () => void;
  sale?: Sale | null;
  projectOptions: SelectOption[];
  onSaved: (sale: Sale) => void;
  onNotFound?: () => void;
}

export function SaleForm({
  open,
  onClose,
  sale,
  projectOptions,
  onSaved,
  onNotFound,
}: SaleFormProps) {
  const toast = useToast();
  const isEdit = !!sale;

  const [form, setForm] = useState<SaleFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Asegura que el proyecto de la venta tenga opción aunque no esté en los 100 cargados.
  const resolvedProjectOptions = useMemo(() => {
    if (sale && !projectOptions.some((o) => o.value === sale.projectId)) {
      return [
        ...projectOptions,
        { value: sale.projectId, label: `Proyecto #${sale.projectId}` },
      ];
    }
    return projectOptions;
  }, [projectOptions, sale]);

  // Ejecutivos = usuarios (selector en vez de pedir el ID a mano).
  const usersFetcher = useCallback(
    (signal?: AbortSignal) =>
      open
        ? listUsers(
            { page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" },
            signal
          )
        : Promise.resolve(null),
    [open]
  );
  const usersRes = useResource<Paginated<User> | null>(usersFetcher, [open]);
  const executiveOptions = useMemo<SelectOption[]>(() => {
    const opts = (usersRes.data?.data ?? []).map((u) => ({
      value: u.id,
      label: `${u.firstName} ${u.lastName}`,
    }));
    if (sale?.executiveId && !opts.some((o) => o.value === sale.executiveId)) {
      opts.push({ value: sale.executiveId, label: `Ejecutivo #${sale.executiveId}` });
    }
    return opts;
  }, [usersRes.data, sale]);

  // Unidades del proyecto seleccionado (selector dependiente del proyecto).
  const projectId = form.projectId;
  const unitsFetcher = useCallback(
    (signal?: AbortSignal) =>
      open && projectId
        ? listProjectUnits(
            projectId,
            { page: 1, limit: 100, sortBy: "code", sortOrder: "ASC" },
            signal
          )
        : Promise.resolve(null),
    [open, projectId]
  );
  const unitsRes = useResource<Paginated<Unit> | null>(unitsFetcher, [open, projectId]);
  const unitOptions = useMemo<SelectOption[]>(() => {
    const opts = (unitsRes.data?.data ?? []).map((u) => ({
      value: u.id,
      label: u.code,
    }));
    if (sale?.unitId && !opts.some((o) => o.value === sale.unitId)) {
      opts.push({ value: sale.unitId, label: `Unidad #${sale.unitId}` });
    }
    return opts;
  }, [unitsRes.data, sale]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario al abrir
    setErrors({});
    setForm(
      sale
        ? {
            leadId: sale.leadId,
            projectId: sale.projectId,
            unitId: sale.unitId ?? "",
            executiveId: sale.executiveId ?? "",
            status: sale.status,
            totalPrice: sale.totalPrice ?? "",
            currency: sale.currency ?? "USD",
            downPayment: sale.downPayment ?? "",
            contractDate: sale.contractDate ?? "",
            financingTermMonths: sale.financingTermMonths?.toString() ?? "",
            interestRate: sale.interestRate ?? "",
            agreements: sale.agreements ?? "",
          }
        : emptyForm
    );
  }, [open, sale]);

  function set<K extends keyof SaleFormState>(key: K, value: SaleFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Al cambiar de proyecto, la unidad anterior deja de ser válida.
  function onProjectChange(value: string) {
    setForm((f) => ({ ...f, projectId: value, unitId: "" }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!isEdit && !form.leadId.trim()) next.leadId = "El lead es obligatorio.";
    if (!isEdit && !form.projectId.trim())
      next.projectId = "El proyecto es obligatorio.";

    if (form.totalPrice.trim() === "") {
      if (!isEdit) next.totalPrice = "El precio total es obligatorio.";
    } else {
      const n = Number(form.totalPrice);
      if (Number.isNaN(n) || n < 0) next.totalPrice = "Debe ser un número ≥ 0.";
    }

    for (const key of ["downPayment", "interestRate"] as const) {
      const v = form[key];
      if (v.trim() !== "") {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0) next[key] = "Debe ser un número ≥ 0.";
      }
    }
    if (form.financingTermMonths.trim() !== "") {
      const n = Number(form.financingTermMonths);
      if (!Number.isInteger(n) || n < 0) next.financingTermMonths = "Entero ≥ 0.";
    }
    if (form.currency.trim() !== "" && form.currency.trim().length !== 3)
      next.currency = "La moneda debe tener 3 letras.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const common = {
      unitId: form.unitId.trim() || undefined,
      executiveId: form.executiveId.trim() || undefined,
      status: form.status,
      currency: form.currency.trim() || undefined,
      downPayment: numOrUndef(form.downPayment),
      contractDate: form.contractDate.trim() || undefined,
      financingTermMonths: numOrUndef(form.financingTermMonths),
      interestRate: numOrUndef(form.interestRate),
    };

    setSubmitting(true);
    try {
      let saved: Sale;
      if (isEdit) {
        const body: UpdateSaleInput = {
          ...common,
          ...(form.totalPrice.trim() === ""
            ? {}
            : { totalPrice: Number(form.totalPrice) }),
          ...(form.agreements.trim()
            ? { agreements: form.agreements.trim() }
            : {}),
        };
        saved = await updateSale(sale!.id, body);
      } else {
        const body: CreateSaleInput = {
          leadId: form.leadId.trim(),
          projectId: form.projectId.trim(),
          totalPrice: Number(form.totalPrice),
          ...common,
          agreements: form.agreements.trim() || undefined,
        };
        saved = await createSale(body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Venta actualizada" : "Venta registrada",
        description: `#${saved.id}`,
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
      } else if (err instanceof ApiException && err.statusCode === 422) {
        const field = fkField(err.messages[0] ?? "");
        if (field) setErrors({ [field]: err.messages[0] });
        toast({ tone: "error", title: errorMessage(err) });
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

  const unitPlaceholder = !form.projectId
    ? "Elegí un proyecto primero"
    : unitsRes.loading
      ? "Cargando unidades…"
      : "Sin unidad";

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar venta" : "Registrar venta"}
      description={
        isEdit
          ? "Actualiza el estado y las condiciones de la venta."
          : "Registra el cierre de una venta."
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
            form="sale-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            {isEdit ? "Guardar cambios" : "Registrar venta"}
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Lead"
            htmlFor="s-lead"
            required={!isEdit}
            error={errors.leadId}
            hint={
              isEdit
                ? "No se puede cambiar tras registrar."
                : "ID del lead (proviene del CRM/agente)."
            }
          >
            <Input
              id="s-lead"
              inputMode="numeric"
              value={form.leadId}
              onChange={(e) => set("leadId", e.target.value)}
              invalid={!!errors.leadId}
              aria-describedby={errors.leadId ? "s-lead-error" : "s-lead-hint"}
              disabled={isEdit}
              placeholder="120"
            />
          </Field>
          <Field
            label="Proyecto"
            htmlFor="s-project"
            required={!isEdit}
            error={errors.projectId}
            hint={
              isEdit
                ? "No se puede cambiar tras registrar."
                : resolvedProjectOptions.length === 0
                  ? "No hay proyectos disponibles. Recarga la página."
                  : undefined
            }
          >
            <Select
              id="s-project"
              options={resolvedProjectOptions}
              placeholder="Selecciona un proyecto"
              value={form.projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              invalid={!!errors.projectId}
              aria-describedby={
                errors.projectId
                  ? "s-project-error"
                  : isEdit
                    ? "s-project-hint"
                    : undefined
              }
              disabled={isEdit}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Unidad" htmlFor="s-unit" error={errors.unitId}>
            <Select
              id="s-unit"
              options={unitOptions}
              placeholder={unitPlaceholder}
              value={form.unitId}
              onChange={(e) => set("unitId", e.target.value)}
              invalid={!!errors.unitId}
              aria-describedby={errors.unitId ? "s-unit-error" : undefined}
              disabled={!form.projectId}
            />
          </Field>
          <Field label="Ejecutivo" htmlFor="s-exec" error={errors.executiveId}>
            <Select
              id="s-exec"
              options={executiveOptions}
              placeholder={usersRes.loading ? "Cargando…" : "Sin asignar"}
              value={form.executiveId}
              onChange={(e) => set("executiveId", e.target.value)}
              invalid={!!errors.executiveId}
              aria-describedby={errors.executiveId ? "s-exec-error" : undefined}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Estado" htmlFor="s-status">
            <Select
              id="s-status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(e) => set("status", e.target.value as SaleStatus)}
            />
          </Field>
          <Field
            label="Precio total"
            htmlFor="s-total"
            required={!isEdit}
            error={errors.totalPrice}
          >
            <Input
              id="s-total"
              type="number"
              min={0}
              step="0.01"
              value={form.totalPrice}
              onChange={(e) => set("totalPrice", e.target.value)}
              invalid={!!errors.totalPrice}
              aria-describedby={errors.totalPrice ? "s-total-error" : undefined}
              placeholder="25000"
            />
          </Field>
          <Field label="Moneda" htmlFor="s-currency" error={errors.currency}>
            <Input
              id="s-currency"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              invalid={!!errors.currency}
              aria-describedby={errors.currency ? "s-currency-error" : undefined}
              placeholder="USD"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cuota inicial" htmlFor="s-down" error={errors.downPayment}>
            <Input
              id="s-down"
              type="number"
              min={0}
              step="0.01"
              value={form.downPayment}
              onChange={(e) => set("downPayment", e.target.value)}
              invalid={!!errors.downPayment}
              aria-describedby={errors.downPayment ? "s-down-error" : undefined}
              placeholder="5000"
            />
          </Field>
          <Field label="Fecha de contrato" htmlFor="s-date">
            <Input
              id="s-date"
              type="date"
              value={form.contractDate}
              onChange={(e) => set("contractDate", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Plazo (meses)"
            htmlFor="s-term"
            error={errors.financingTermMonths}
          >
            <Input
              id="s-term"
              type="number"
              min={0}
              value={form.financingTermMonths}
              onChange={(e) => set("financingTermMonths", e.target.value)}
              invalid={!!errors.financingTermMonths}
              aria-describedby={
                errors.financingTermMonths ? "s-term-error" : undefined
              }
              placeholder="60"
            />
          </Field>
          <Field
            label="Tasa de interés (%)"
            htmlFor="s-rate"
            error={errors.interestRate}
          >
            <Input
              id="s-rate"
              type="number"
              min={0}
              step="0.01"
              value={form.interestRate}
              onChange={(e) => set("interestRate", e.target.value)}
              invalid={!!errors.interestRate}
              aria-describedby={errors.interestRate ? "s-rate-error" : undefined}
              placeholder="12.5"
            />
          </Field>
        </div>

        <Field label="Acuerdos" htmlFor="s-agreements">
          <Textarea
            id="s-agreements"
            value={form.agreements}
            onChange={(e) => set("agreements", e.target.value)}
            placeholder="Incluye entrega de llaves en 30 días."
          />
        </Field>
      </form>
    </Dialog>
  );
}
