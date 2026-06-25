"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Wand2,
  FileText,
  Paperclip,
  Tags as TagsIcon,
  ToggleRight,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ImageGalleryUpload } from "@/components/ui/image-gallery-upload";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createKbEntry,
  updateKbEntry,
  aiDraft,
  type CreateKbEntryInput,
  type UpdateKbEntryInput,
} from "@/lib/api/kb";
import { BRAND_LABELS } from "@/lib/constants";
import type { KbEntry, KbCategory, KbTag, Brand } from "@/lib/api/types";

const BRAND_OPTIONS = [
  { value: "", label: "Sin marca" },
  ...(Object.keys(BRAND_LABELS) as Brand[]).map((b) => ({ value: b, label: BRAND_LABELS[b] })),
];

interface Props {
  onCancel: () => void;
  entry?: KbEntry | null;
  categories: KbCategory[];
  tags: KbTag[];
  projectOptions: SelectOption[];
  canWrite: boolean;
  onSaved: (entry: KbEntry) => void;
  onNotFound?: () => void;
}

/** Encabezado de sección dentro del formulario: agrupa campos relacionados. */
function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function KbEntryForm({
  onCancel,
  entry,
  categories,
  tags,
  projectOptions,
  canWrite,
  onSaved,
  onNotFound,
}: Props) {
  const toast = useToast();
  const isEdit = !!entry;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set());
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Asistente IA
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del formulario según la entrada
    setErrors({});
    setTopic("");
    setInstructions("");
    setTitle(entry?.title ?? "");
    setContent(entry?.content ?? "");
    setCategoryId(entry?.categoryId ?? "");
    setProjectId(entry?.projectId ?? "");
    setBrand(entry?.brand ?? "");
    setPriority(entry?.priority?.toString() ?? "0");
    setIsActive(entry?.isActive ?? true);
    setTagIds(new Set((entry?.tags ?? []).map((t) => t.id)));
    setMediaUrls(entry?.mediaUrls ?? []);
  }, [entry]);

  function toggleTag(id: string, checked: boolean) {
    setTagIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function generateDraft() {
    if (!topic.trim()) {
      setErrors((e) => ({ ...e, topic: "Indica un tema." }));
      return;
    }
    setDrafting(true);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      const draft = await aiDraft({
        topic: topic.trim(),
        categoryCode: cat?.code,
        brand: (brand || undefined) as Brand | undefined,
        existingContent: content.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });
      setTitle(draft.title);
      setContent(draft.content);
      toast({ tone: "success", title: "Borrador generado", description: "Revísalo y edítalo antes de guardar." });
    } catch (err) {
      toast({ tone: "error", title: "No se pudo generar", description: errorMessage(err) });
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "El título es obligatorio.";
    if (!content.trim()) next.content = "El contenido es obligatorio.";
    if (priority.trim() !== "") {
      const n = Number(priority);
      if (!Number.isInteger(n) || n < 0) next.priority = "Entero ≥ 0.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const common = {
      title: title.trim(),
      content: content.trim(),
      categoryId: categoryId || undefined,
      projectId: projectId || undefined,
      brand: (brand || undefined) as Brand | undefined,
      priority: priority.trim() === "" ? undefined : Number(priority),
      isActive,
      tagIds: [...tagIds],
      mediaUrls,
    };

    setSubmitting(true);
    try {
      const saved = isEdit
        ? await updateKbEntry(entry!.id, common satisfies UpdateKbEntryInput)
        : await createKbEntry(common satisfies CreateKbEntryInput);
      // El embedding se regenera (async) solo si cambió el título o el contenido.
      const textChanged =
        !isEdit ||
        title.trim() !== (entry?.title ?? "") ||
        content.trim() !== (entry?.content ?? "");
      toast({
        tone: "success",
        title: isEdit ? "Entrada actualizada" : "Entrada creada",
        description: textChanged
          ? "El índice del agente se actualizará en unos segundos."
          : undefined,
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        const { fieldErrors, rest } = mapValidationErrors(err, ["title", "content", "priority", "categoryId", "tagIds"]);
        setErrors(fieldErrors);
        if (rest.length) toast({ tone: "error", title: "Revisa los campos del formulario", description: rest.join(" ") });
      } else if (err instanceof ApiException && err.statusCode === 422) {
        const msg = err.messages[0] ?? "";
        setErrors(/tag/i.test(msg) ? { tagIds: msg } : { categoryId: msg });
        toast({ tone: "error", title: msg });
      } else if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: errorMessage(err) });
        onNotFound?.();
      } else {
        toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="kb-form" onSubmit={handleSubmit} noValidate className="space-y-6">
      {canWrite && (
        <Card className="overflow-hidden border-primary/30 bg-primary-soft/40 p-0">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                  Redacta con IA
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Escribe el tema y la IA genera un borrador de título y contenido que luego
                  puedes editar. Es la forma más rápida de crear una entrada bien redactada.
                </p>
              </div>
            </div>

            <Field
              label="Tema"
              htmlFor="kb-topic"
              error={errors.topic}
              hint="¿Sobre qué quieres que escriba? Sé concreto."
            >
              <Input
                id="kb-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                invalid={!!errors.topic}
                aria-describedby={errors.topic ? "kb-topic-error" : "kb-topic-hint"}
                placeholder="Ej. requisitos para acceder a crédito directo"
                className="text-base"
              />
            </Field>

            <Field
              label="Instrucciones (opcional)"
              htmlFor="kb-instructions"
              hint="Indica tono, longitud o enfoque si quieres afinar el resultado."
            >
              <Input
                id="kb-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={500}
                aria-describedby="kb-instructions-hint"
                placeholder="Ej. tono cercano, máximo 4 párrafos, incluye un ejemplo"
              />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {content.trim()
                  ? "Se usará lo que ya escribiste abajo como base para mejorarlo."
                  : "El borrador reemplazará el título y el contenido de abajo."}
              </p>
              <Button
                type="button"
                onClick={generateDraft}
                disabled={drafting}
                aria-busy={drafting}
                className="sm:w-auto"
              >
                {drafting ? <Spinner /> : <Wand2 className="h-4 w-4" />}
                {drafting ? "Generando…" : "Generar borrador"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-8 p-5 sm:p-6">
          <FormSection
            icon={FileText}
            title="Entrada"
            description="El texto que leerá el agente. Puedes escribirlo a mano o partir del borrador de IA."
          >
            <Field label="Título" htmlFor="kb-title" required error={errors.title}>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                invalid={!!errors.title}
                aria-describedby={errors.title ? "kb-title-error" : undefined}
                placeholder="Un título corto y claro"
              />
            </Field>
            <Field
              label="Contenido"
              htmlFor="kb-content"
              required
              error={errors.content}
              hint="Explica el tema con tus palabras. Cuanto más claro, mejor responde el agente."
            >
              <Textarea
                id="kb-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                invalid={!!errors.content}
                aria-describedby={errors.content ? "kb-content-error" : "kb-content-hint"}
                className="min-h-48"
                placeholder="Escribe aquí el contenido de la entrada…"
              />
            </Field>
          </FormSection>

          <div className="border-t border-border" />

          <FormSection
            icon={TagsIcon}
            title="Clasificación"
            description="Ayuda al agente a saber cuándo usar esta entrada."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Categoría"
                htmlFor="kb-cat"
                error={errors.categoryId}
                hint="Agrupa la entrada por tema."
              >
                <Select
                  id="kb-cat"
                  options={[{ value: "", label: "Sin categoría" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  invalid={!!errors.categoryId}
                  aria-describedby={errors.categoryId ? "kb-cat-error" : "kb-cat-hint"}
                />
              </Field>
              <Field label="Marca" htmlFor="kb-brand" hint="Si aplica solo a una marca.">
                <Select
                  id="kb-brand"
                  options={BRAND_OPTIONS}
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  aria-describedby="kb-brand-hint"
                />
              </Field>
              <Field
                label="Proyecto"
                htmlFor="kb-proj"
                hint="Déjalo en Global si sirve para todos los proyectos."
              >
                <Select
                  id="kb-proj"
                  options={[{ value: "", label: "Global" }, ...projectOptions]}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-describedby="kb-proj-hint"
                />
              </Field>
              <Field
                label="Prioridad"
                htmlFor="kb-prio"
                error={errors.priority}
                hint="Un número mayor hace que el agente la prefiera."
              >
                <Input
                  id="kb-prio"
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  invalid={!!errors.priority}
                  aria-describedby={errors.priority ? "kb-prio-error" : "kb-prio-hint"}
                />
              </Field>
            </div>
          </FormSection>

          <div className="border-t border-border" />

          <FormSection
            icon={Paperclip}
            title="Adjuntos"
            description="Imágenes o archivos de apoyo. Opcional."
          >
            <Field label="Imágenes" htmlFor="kb-media">
              <ImageGalleryUpload
                id="kb-media"
                value={mediaUrls}
                onChange={setMediaUrls}
                folder="general"
              />
            </Field>
          </FormSection>

          {tags.length > 0 && (
            <>
              <div className="border-t border-border" />
              <FormSection
                icon={TagsIcon}
                title="Etiquetas"
                description="Palabras clave para encontrar y filtrar la entrada."
              >
                <Field label="Etiquetas" htmlFor="kb-tags" error={errors.tagIds}>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border p-3">
                    {tags.map((t) => (
                      <Checkbox
                        key={t.id}
                        checked={tagIds.has(t.id)}
                        onCheckedChange={(c) => toggleTag(t.id, c)}
                        label={t.name}
                      />
                    ))}
                  </div>
                </Field>
              </FormSection>
            </>
          )}

          <div className="border-t border-border" />

          <FormSection
            icon={ToggleRight}
            title="Disponibilidad"
            description="Controla si el agente puede usar esta entrada."
          >
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Entrada activa</p>
                <p className="text-xs text-muted">Las inactivas no se usan en el agente.</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Entrada activa" />
            </div>

            {isEdit && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted/40 px-4 py-3 text-xs text-muted">
                {entry?.hasEmbedding ? (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <p>
                      <span className="font-medium text-foreground">Indexada.</span>{" "}
                      El agente ya puede encontrar y usar esta entrada en sus respuestas. Si
                      cambias el título o el contenido, volverá a indexarse en unos segundos.
                    </p>
                  </>
                ) : (
                  <>
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p>
                      <span className="font-medium text-foreground">Indexando…</span>{" "}
                      El agente está preparando esta entrada para poder usarla. Suele tardar
                      unos segundos.
                    </p>
                  </>
                )}
              </div>
            )}
          </FormSection>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-app/85 px-1 py-3 backdrop-blur">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting && <Spinner />}
          {isEdit ? "Guardar cambios" : "Crear entrada"}
        </Button>
      </div>
    </form>
  );
}
