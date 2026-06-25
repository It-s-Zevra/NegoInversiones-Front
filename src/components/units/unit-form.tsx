"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ImageGalleryUpload } from "@/components/ui/image-gallery-upload";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createProjectUnit,
  updateUnit,
  type CreateUnitInput,
  type UpdateUnitInput,
} from "@/lib/api/units";
import { listFinancingPlans } from "@/lib/api/financing";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import type { Unit, UnitType, FinancingPlan, Paginated } from "@/lib/api/types";

const TYPE_OPTIONS = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => ({
  value: t,
  label: UNIT_TYPE_LABELS[t],
}));

interface UnitFormState {
  code: string;
  type: UnitType;
  price: string;
  currency: string;
  areaM2: string;
  bedrooms: string;
  bathrooms: string;
  builtAreaM2: string;
  frontageM: string;
  depthM: string;
  hasUtilities: boolean;
  location: string;
  address1: string;
  address2: string;
  references: string;
  financingPlanId: string;
  imgUrl: string[];
}

const emptyForm: UnitFormState = {
  code: "",
  type: "LOTE",
  price: "",
  currency: "USD",
  areaM2: "",
  bedrooms: "",
  bathrooms: "",
  builtAreaM2: "",
  frontageM: "",
  depthM: "",
  hasUtilities: false,
  location: "",
  address1: "",
  address2: "",
  references: "",
  financingPlanId: "",
  imgUrl: [],
};

function numOrUndef(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

interface UnitFormProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  unit?: Unit | null;
  onSaved: (unit: Unit) => void;
  onNotFound?: () => void;
}

export function UnitForm({
  open,
  onClose,
  projectId,
  unit,
  onSaved,
  onNotFound,
}: UnitFormProps) {
  const toast = useToast();
  const isEdit = !!unit;

  const [form, setForm] = useState<UnitFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Catálogo de planes para el combobox (en vez de teclear el id).
  const plansFetcher = useCallback(
    (signal?: AbortSignal) =>
      open
        ? listFinancingPlans(
            { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" },
            signal
          )
        : Promise.resolve(null),
    [open]
  );
  const plansRes = useResource<Paginated<FinancingPlan> | null>(plansFetcher, [open]);
  const planOptions = useMemo(() => {
    const opts = [
      { value: "", label: "Sin plan" },
      ...(plansRes.data?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    ];
    if (unit?.financingPlanId && !opts.some((o) => o.value === unit.financingPlanId)) {
      opts.push({ value: unit.financingPlanId, label: `Plan #${unit.financingPlanId}` });
    }
    return opts;
  }, [plansRes.data, unit]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario al abrir
    setErrors({});
    setForm(
      unit
        ? {
            code: unit.code,
            type: unit.type,
            price: unit.price ?? "",
            currency: unit.currency ?? "USD",
            areaM2: unit.areaM2 ?? "",
            bedrooms: unit.bedrooms?.toString() ?? "",
            bathrooms: unit.bathrooms?.toString() ?? "",
            builtAreaM2: unit.builtAreaM2 ?? "",
            frontageM: unit.frontageM ?? "",
            depthM: unit.depthM ?? "",
            hasUtilities: unit.hasUtilities ?? false,
            location: unit.location ?? "",
            address1: unit.address1 ?? "",
            address2: unit.address2 ?? "",
            references: unit.references ?? "",
            financingPlanId: unit.financingPlanId ?? "",
            imgUrl: unit.imgUrl ?? [],
          }
        : emptyForm
    );
  }, [open, unit]);

  function set<K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = "El código es obligatorio.";

    const decimals: [keyof UnitFormState, string][] = [
      ["price", "price"],
      ["areaM2", "areaM2"],
      ["builtAreaM2", "builtAreaM2"],
      ["frontageM", "frontageM"],
      ["depthM", "depthM"],
    ];
    for (const [key] of decimals) {
      const v = form[key] as string;
      if (v.trim() !== "") {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0) next[key] = "Debe ser un número ≥ 0.";
      }
    }
    for (const key of ["bedrooms", "bathrooms"] as const) {
      const v = form[key];
      if (v.trim() !== "") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) next[key] = "Entero ≥ 0.";
      }
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
      code: form.code.trim(),
      type: form.type,
      currency: form.currency.trim() || undefined,
      hasUtilities: form.hasUtilities,
      price: numOrUndef(form.price),
      areaM2: numOrUndef(form.areaM2),
      // En edición se envía siempre (permite vaciar la galería); en alta solo si hay.
      ...(isEdit || form.imgUrl.length ? { imgUrl: form.imgUrl } : {}),
    };
    const typeFields =
      form.type === "VIVIENDA"
        ? {
            bedrooms: numOrUndef(form.bedrooms),
            bathrooms: numOrUndef(form.bathrooms),
            builtAreaM2: numOrUndef(form.builtAreaM2),
          }
        : {
            frontageM: numOrUndef(form.frontageM),
            depthM: numOrUndef(form.depthM),
          };
    const plan = form.financingPlanId.trim();

    setSubmitting(true);
    try {
      let saved: Unit;
      if (isEdit) {
        const body: UpdateUnitInput = {
          ...common,
          ...typeFields,
          location: form.location.trim(),
          address1: form.address1.trim(),
          address2: form.address2.trim(),
          references: form.references.trim(),
          ...(plan ? { financingPlanId: plan } : {}),
        };
        saved = await updateUnit(unit!.id, body);
      } else {
        const body: CreateUnitInput = {
          ...common,
          ...typeFields,
          location: form.location.trim() || undefined,
          address1: form.address1.trim() || undefined,
          address2: form.address2.trim() || undefined,
          references: form.references.trim() || undefined,
          ...(plan ? { financingPlanId: plan } : {}),
        };
        saved = await createProjectUnit(projectId, body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Unidad actualizada" : "Unidad creada",
        description: saved.code,
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
      } else if (err instanceof ApiException && err.statusCode === 409) {
        setErrors({ code: err.messages[0] });
        toast({ tone: "error", title: "Código duplicado" });
      } else if (err instanceof ApiException && err.statusCode === 422) {
        setErrors({ financingPlanId: err.messages[0] });
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

  const isVivienda = form.type === "VIVIENDA";

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar unidad" : "Nueva unidad"}
      description={
        isEdit ? "Actualiza los datos de la unidad." : "Agrega una unidad al proyecto."
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
            form="unit-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            {isEdit ? "Guardar cambios" : "Crear unidad"}
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código" htmlFor="u-code" required error={errors.code}>
            <Input
              id="u-code"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              invalid={!!errors.code}
              aria-describedby={errors.code ? "u-code-error" : undefined}
              placeholder="L-01"
            />
          </Field>
          <Field
            label="Tipo"
            htmlFor="u-type"
            required
            hint={isEdit ? "El tipo no se puede cambiar tras crearla." : undefined}
          >
            <Select
              id="u-type"
              options={TYPE_OPTIONS}
              value={form.type}
              disabled={isEdit}
              onChange={(e) => set("type", e.target.value as UnitType)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Precio" htmlFor="u-price" error={errors.price}>
            <Input
              id="u-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              invalid={!!errors.price}
              aria-describedby={errors.price ? "u-price-error" : undefined}
              placeholder="25000"
            />
          </Field>
          <Field label="Moneda" htmlFor="u-currency" error={errors.currency}>
            <Input
              id="u-currency"
              maxLength={3}
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              invalid={!!errors.currency}
              aria-describedby={errors.currency ? "u-currency-error" : undefined}
              placeholder="USD"
            />
          </Field>
          <Field label="Área (m²)" htmlFor="u-area" error={errors.areaM2}>
            <Input
              id="u-area"
              type="number"
              min={0}
              step="0.01"
              value={form.areaM2}
              onChange={(e) => set("areaM2", e.target.value)}
              invalid={!!errors.areaM2}
              aria-describedby={errors.areaM2 ? "u-area-error" : undefined}
              placeholder="360.5"
            />
          </Field>
        </div>

        {/* Campos específicos por tipo */}
        {isVivienda ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Dormitorios" htmlFor="u-bed" error={errors.bedrooms}>
              <Input
                id="u-bed"
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(e) => set("bedrooms", e.target.value)}
                invalid={!!errors.bedrooms}
                aria-describedby={errors.bedrooms ? "u-bed-error" : undefined}
              />
            </Field>
            <Field label="Baños" htmlFor="u-bath" error={errors.bathrooms}>
              <Input
                id="u-bath"
                type="number"
                min={0}
                value={form.bathrooms}
                onChange={(e) => set("bathrooms", e.target.value)}
                invalid={!!errors.bathrooms}
                aria-describedby={errors.bathrooms ? "u-bath-error" : undefined}
              />
            </Field>
            <Field
              label="Sup. construida (m²)"
              htmlFor="u-built"
              error={errors.builtAreaM2}
            >
              <Input
                id="u-built"
                type="number"
                min={0}
                step="0.01"
                value={form.builtAreaM2}
                onChange={(e) => set("builtAreaM2", e.target.value)}
                invalid={!!errors.builtAreaM2}
                aria-describedby={
                  errors.builtAreaM2 ? "u-built-error" : undefined
                }
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Frente (m)" htmlFor="u-front" error={errors.frontageM}>
              <Input
                id="u-front"
                type="number"
                min={0}
                step="0.01"
                value={form.frontageM}
                onChange={(e) => set("frontageM", e.target.value)}
                invalid={!!errors.frontageM}
                aria-describedby={errors.frontageM ? "u-front-error" : undefined}
              />
            </Field>
            <Field label="Fondo (m)" htmlFor="u-depth" error={errors.depthM}>
              <Input
                id="u-depth"
                type="number"
                min={0}
                step="0.01"
                value={form.depthM}
                onChange={(e) => set("depthM", e.target.value)}
                invalid={!!errors.depthM}
                aria-describedby={errors.depthM ? "u-depth-error" : undefined}
              />
            </Field>
          </div>
        )}

        <Field label="Ubicación / sector" htmlFor="u-loc" error={errors.location}>
          <Input
            id="u-loc"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Manzano C"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dirección" htmlFor="u-addr1" error={errors.address1}>
            <Input
              id="u-addr1"
              value={form.address1}
              onChange={(e) => set("address1", e.target.value)}
              placeholder="Calle 4 #123"
            />
          </Field>
          <Field label="Complemento" htmlFor="u-addr2" error={errors.address2}>
            <Input
              id="u-addr2"
              value={form.address2}
              onChange={(e) => set("address2", e.target.value)}
              placeholder="Esquina"
            />
          </Field>
        </div>

        <Field label="Referencias" htmlFor="u-ref" error={errors.references}>
          <Textarea
            id="u-ref"
            value={form.references}
            onChange={(e) => set("references", e.target.value)}
            placeholder="Frente a la plaza central."
          />
        </Field>

        <Field label="Galería de fotos" htmlFor="u-gallery">
          <ImageGalleryUpload
            id="u-gallery"
            value={form.imgUrl}
            onChange={(urls) => set("imgUrl", urls)}
            folder="units"
          />
        </Field>

        <Field
          label="Plan de financiamiento"
          htmlFor="u-fin"
          hint="Plan por defecto de la unidad (opcional)."
          error={errors.financingPlanId}
        >
          <Select
            id="u-fin"
            options={planOptions}
            value={form.financingPlanId}
            onChange={(e) => set("financingPlanId", e.target.value)}
            invalid={!!errors.financingPlanId}
            aria-describedby={errors.financingPlanId ? "u-fin-error" : undefined}
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Cuenta con servicios
            </p>
            <p className="text-xs text-muted">Agua, luz, etc.</p>
          </div>
          <Switch
            checked={form.hasUtilities}
            onCheckedChange={(v) => set("hasUtilities", v)}
            aria-label="Cuenta con servicios básicos"
          />
        </div>
      </form>
    </Dialog>
  );
}
