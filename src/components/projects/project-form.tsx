"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createProject,
  updateProject,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/api/projects";
import { BRAND_LABELS, UNIT_TYPE_LABELS } from "@/lib/constants";
import type { Project, Brand, UnitType } from "@/lib/api/types";

const BRAND_OPTIONS = (Object.keys(BRAND_LABELS) as Brand[]).map((b) => ({
  value: b,
  label: BRAND_LABELS[b],
}));
const TYPE_OPTIONS = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => ({
  value: t,
  label: UNIT_TYPE_LABELS[t],
}));

interface FormState {
  name: string;
  brand: Brand;
  type: UnitType;
  city: string;
  location: string;
  description: string;
  totalUnits: string;
  imgUrl: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  brand: "VISTA_VERDE",
  type: "LOTE",
  city: "",
  location: "",
  description: "",
  totalUnits: "",
  imgUrl: "",
  isActive: true,
};

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  project?: Project | null;
  onSaved: (project: Project) => void;
  /** Se llama si la edición devuelve 404 (el proyecto ya no existe). */
  onNotFound?: () => void;
}

export function ProjectForm({
  open,
  onClose,
  project,
  onSaved,
  onNotFound,
}: ProjectFormProps) {
  const toast = useToast();
  const isEdit = !!project;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario al abrir el diálogo
    setErrors({});
    setForm(
      project
        ? {
            name: project.name,
            brand: project.brand,
            type: project.type,
            city: project.city ?? "",
            location: project.location ?? "",
            description: project.description ?? "",
            totalUnits:
              project.totalUnits === null || project.totalUnits === undefined
                ? ""
                : String(project.totalUnits),
            imgUrl: project.imgUrl ?? "",
            isActive: project.isActive,
          }
        : emptyForm
    );
  }, [open, project]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    if (form.totalUnits !== "") {
      const n = Number(form.totalUnits);
      if (!Number.isInteger(n) || n < 0)
        next.totalUnits = "Debe ser un entero mayor o igual a 0.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const required = {
      name: form.name.trim(),
      brand: form.brand,
      type: form.type,
    };

    setSubmitting(true);
    try {
      let saved: Project;
      if (isEdit) {
        // En edición enviamos los strings tal cual (incluido "") para permitir
        // limpiar un campo opcional previamente seteado.
        const body: UpdateProjectInput = {
          ...required,
          city: form.city.trim(),
          location: form.location.trim(),
          description: form.description.trim(),
          imgUrl: form.imgUrl.trim(),
          isActive: form.isActive,
          ...(form.totalUnits === ""
            ? {}
            : { totalUnits: Number(form.totalUnits) }),
        };
        saved = await updateProject(project!.id, body);
      } else {
        // En creación omitimos los opcionales vacíos.
        const body: CreateProjectInput = {
          ...required,
          city: form.city.trim() || undefined,
          location: form.location.trim() || undefined,
          description: form.description.trim() || undefined,
          imgUrl: form.imgUrl.trim() || undefined,
          totalUnits:
            form.totalUnits === "" ? undefined : Number(form.totalUnits),
        };
        saved = await createProject(body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Proyecto actualizado" : "Proyecto creado",
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
        toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar proyecto" : "Nuevo proyecto"}
      description={
        isEdit
          ? "Actualiza los datos del proyecto."
          : "Crea un proyecto inmobiliario."
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
            form="project-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            {isEdit ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Nombre" htmlFor="p-name" required error={errors.name}>
          <Input
            id="p-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            invalid={!!errors.name}
            aria-describedby={errors.name ? "p-name-error" : undefined}
            placeholder="Vista Verde Etapa II"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Marca" htmlFor="p-brand" required error={errors.brand}>
            <Select
              id="p-brand"
              options={BRAND_OPTIONS}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value as Brand)}
              invalid={!!errors.brand}
            />
          </Field>
          <Field label="Tipo" htmlFor="p-type" required error={errors.type}>
            <Select
              id="p-type"
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={(e) => set("type", e.target.value as UnitType)}
              invalid={!!errors.type}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ciudad" htmlFor="p-city" error={errors.city}>
            <Input
              id="p-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Santa Cruz de la Sierra"
            />
          </Field>
          <Field
            label="Total de unidades"
            htmlFor="p-units"
            error={errors.totalUnits}
          >
            <Input
              id="p-units"
              type="number"
              min={0}
              value={form.totalUnits}
              onChange={(e) => set("totalUnits", e.target.value)}
              invalid={!!errors.totalUnits}
              placeholder="120"
            />
          </Field>
        </div>

        <Field label="Ubicación" htmlFor="p-location" error={errors.location}>
          <Input
            id="p-location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Av. Banzer km 9"
          />
        </Field>

        <Field label="Descripción" htmlFor="p-desc" error={errors.description}>
          <Textarea
            id="p-desc"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Loteamiento residencial con áreas verdes."
          />
        </Field>

        <Field label="Imagen de portada" htmlFor="p-img" error={errors.imgUrl}>
          <ImageUpload
            id="p-img"
            value={form.imgUrl}
            onChange={(url) => set("imgUrl", url)}
            folder="projects"
          />
        </Field>

        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Proyecto activo
              </p>
              <p className="text-xs text-muted">
                Los inactivos no aparecen por defecto en el listado.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v)}
              aria-label="Proyecto activo"
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}
