"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  metaRows: { key: string; value: string }[];
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
  metaRows: [],
};

function metadataToRows(
  metadata: Record<string, unknown> | null | undefined,
): { key: string; value: string }[] {
  if (!metadata) return [];
  return Object.entries(metadata).map(([key, v]) => ({
    key,
    value: typeof v === "string" ? v : JSON.stringify(v),
  }));
}

interface ProjectFormProps {
  onCancel: () => void;
  project?: Project | null;
  onSaved: (project: Project) => void;
  /** Se llama si la edición devuelve 404 (el proyecto ya no existe). */
  onNotFound?: () => void;
}

export function ProjectForm({
  onCancel,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario según la entidad
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
            metaRows: metadataToRows(project.metadata),
          }
        : emptyForm,
    );
  }, [project]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setMetaRow(i: number, field: "key" | "value", value: string) {
    setForm((f) => ({
      ...f,
      metaRows: f.metaRows.map((r, idx) =>
        idx === i ? { ...r, [field]: value } : r,
      ),
    }));
  }
  function addMetaRow() {
    setForm((f) => ({
      ...f,
      metaRows: [...f.metaRows, { key: "", value: "" }],
    }));
  }
  function removeMetaRow(i: number) {
    setForm((f) => ({
      ...f,
      metaRows: f.metaRows.filter((_, idx) => idx !== i),
    }));
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
    const metadata = Object.fromEntries(
      form.metaRows
        .filter((r) => r.key.trim())
        .map((r) => [r.key.trim(), r.value]),
    );

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
          metadata,
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
          ...(Object.keys(metadata).length ? { metadata } : {}),
        };
        saved = await createProject(body);
      }

      toast({
        tone: "success",
        title: isEdit ? "Proyecto actualizado" : "Proyecto creado",
        description: saved.name,
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        const { fieldErrors, rest } = mapValidationErrors(
          err,
          Object.keys(emptyForm),
        );
        setErrors(fieldErrors);
        toast({
          tone: "error",
          title: "Revisa los campos del formulario",
          description: rest.length ? rest.join(" ") : undefined,
        });
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

  return (
    <form
      id="project-form"
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <Card>
        <CardContent className="space-y-8 p-5 sm:p-6">
          {/* Datos del proyecto */}
          <section className="space-y-4">
            <div className="space-y-0.5">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Datos del proyecto
              </h3>
              <p className="text-xs text-muted">
                Identifica el proyecto y clasifícalo por marca y tipo de unidad.
              </p>
            </div>

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
              <Field
                label="Marca"
                htmlFor="p-brand"
                required
                error={errors.brand}
              >
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

            <Field
              label="Total de unidades"
              htmlFor="p-units"
              error={errors.totalUnits}
              hint="Cantidad de lotes o unidades del proyecto. Déjalo vacío si aún no lo defines."
            >
              <Input
                id="p-units"
                type="number"
                min={0}
                value={form.totalUnits}
                onChange={(e) => set("totalUnits", e.target.value)}
                invalid={!!errors.totalUnits}
                aria-describedby={
                  errors.totalUnits ? "p-units-error" : "p-units-hint"
                }
                placeholder="120"
              />
            </Field>

            <Field
              label="Descripción"
              htmlFor="p-desc"
              error={errors.description}
            >
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Loteamiento residencial con áreas verdes."
              />
            </Field>
          </section>

          <div className="h-px bg-border" />

          {/* Ubicación */}
          <section className="space-y-4">
            <div className="space-y-0.5">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Ubicación
              </h3>
              <p className="text-xs text-muted">
                Dónde se encuentra el proyecto. Ambos campos son opcionales.
              </p>
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
                label="Ubicación"
                htmlFor="p-location"
                error={errors.location}
              >
                <Input
                  id="p-location"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Av. Banzer km 9"
                />
              </Field>
            </div>
          </section>

          <div className="h-px bg-border" />

          {/* Portada */}
          <section className="space-y-4">
            <div className="space-y-0.5">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Portada
              </h3>
              <p className="text-xs text-muted">
                Imagen que representa al proyecto en el listado y las fichas.
              </p>
            </div>

            <Field
              label="Imagen de portada"
              htmlFor="p-img"
              error={errors.imgUrl}
            >
              <ImageUpload
                id="p-img"
                value={form.imgUrl}
                onChange={(url) => set("imgUrl", url)}
                folder="projects"
              />
            </Field>
          </section>

          <div className="h-px bg-border" />

          {/* Metadata */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                  Metadata
                  <span className="ml-2 align-middle text-xs font-normal text-subtle">
                    opcional
                  </span>
                </h3>
                <p className="text-xs text-muted">
                  Campos personalizados clave/valor (p. ej. mapa, video,
                  contacto).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMetaRow}
              >
                <Plus className="h-4 w-4" />
                Agregar campo
              </Button>
            </div>

            {form.metaRows.length === 0 ? (
              <div className="rounded-card border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-center">
                <p className="text-sm text-muted">
                  Aún no hay campos personalizados.
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Usa{" "}
                  <span className="font-medium text-foreground">
                    Agregar campo
                  </span>{" "}
                  para sumar pares clave/valor.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-border">
                <div className="hidden grid-cols-[1fr_1fr_2.25rem] gap-3 border-b border-border bg-surface-muted/60 px-3 py-2 sm:grid">
                  <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                    Clave
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                    Valor
                  </span>
                  <span className="sr-only">Acciones</span>
                </div>
                <div className="divide-y divide-border">
                  {form.metaRows.map((r, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 gap-3 px-3 py-2.5 sm:grid-cols-[1fr_1fr_2.25rem] sm:items-center"
                    >
                      <Input
                        aria-label={`Clave ${i + 1}`}
                        value={r.key}
                        onChange={(e) => setMetaRow(i, "key", e.target.value)}
                        placeholder="clave"
                      />
                      <Input
                        aria-label={`Valor ${i + 1}`}
                        value={r.value}
                        onChange={(e) => setMetaRow(i, "value", e.target.value)}
                        placeholder="valor"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetaRow(i)}
                        className="grid h-9 w-9 shrink-0 place-items-center justify-self-end rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Quitar campo ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {isEdit && (
            <>
              <div className="h-px bg-border" />
              <section className="space-y-4">
                <div className="space-y-0.5">
                  <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                    Estado
                  </h3>
                  <p className="text-xs text-muted">
                    Controla la visibilidad del proyecto en el panel.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-muted/50 px-4 py-3">
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
              </section>
            </>
          )}
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
          {isEdit ? "Guardar cambios" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
