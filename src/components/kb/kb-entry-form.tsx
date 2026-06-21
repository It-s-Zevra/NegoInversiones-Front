"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
  open: boolean;
  onClose: () => void;
  entry?: KbEntry | null;
  categories: KbCategory[];
  tags: KbTag[];
  projectOptions: SelectOption[];
  canWrite: boolean;
  onSaved: () => void;
  onNotFound?: () => void;
}

export function KbEntryForm({
  open,
  onClose,
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Asistente IA
  const [topic, setTopic] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setErrors({});
    setTopic("");
    setTitle(entry?.title ?? "");
    setContent(entry?.content ?? "");
    setCategoryId(entry?.categoryId ?? "");
    setProjectId(entry?.projectId ?? "");
    setBrand(entry?.brand ?? "");
    setPriority(entry?.priority?.toString() ?? "0");
    setIsActive(entry?.isActive ?? true);
    setTagIds(new Set((entry?.tags ?? []).map((t) => t.id)));
  }, [open, entry]);

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
      });
      setTitle(draft.title);
      setContent(draft.content);
      toast({ tone: "success", title: "Borrador generado", description: "Revísalo antes de guardar." });
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
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateKbEntry(entry!.id, common satisfies UpdateKbEntryInput);
      } else {
        await createKbEntry(common satisfies CreateKbEntryInput);
      }
      toast({ tone: "success", title: isEdit ? "Entrada actualizada" : "Entrada creada" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(mapValidationErrors(err, ["title", "content", "priority", "categoryId", "tagIds"]).fieldErrors);
      } else if (err instanceof ApiException && err.statusCode === 422) {
        const msg = err.messages[0] ?? "";
        setErrors(/tag/i.test(msg) ? { tagIds: msg } : { categoryId: msg });
        toast({ tone: "error", title: msg });
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
      title={isEdit ? "Editar entrada" : "Nueva entrada"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="kb-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="kb-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {canWrite && (
          <div className="rounded-lg border border-primary/30 bg-primary-soft/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Asistente de redacción IA
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                invalid={!!errors.topic}
                placeholder="Tema, p. ej. requisitos para crédito directo"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={generateDraft}
                disabled={drafting}
                aria-busy={drafting}
              >
                {drafting ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                Generar
              </Button>
            </div>
            {errors.topic && <p className="mt-1 text-xs text-danger">{errors.topic}</p>}
          </div>
        )}

        <Field label="Título" htmlFor="kb-title" required error={errors.title}>
          <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)}
            invalid={!!errors.title} aria-describedby={errors.title ? "kb-title-error" : undefined} />
        </Field>
        <Field label="Contenido" htmlFor="kb-content" required error={errors.content}>
          <Textarea id="kb-content" value={content} onChange={(e) => setContent(e.target.value)}
            invalid={!!errors.content} aria-describedby={errors.content ? "kb-content-error" : undefined}
            className="min-h-40" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoría" htmlFor="kb-cat" error={errors.categoryId}>
            <Select id="kb-cat"
              options={[{ value: "", label: "Sin categoría" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              invalid={!!errors.categoryId} aria-describedby={errors.categoryId ? "kb-cat-error" : undefined} />
          </Field>
          <Field label="Marca" htmlFor="kb-brand">
            <Select id="kb-brand" options={BRAND_OPTIONS} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </Field>
          <Field label="Proyecto" htmlFor="kb-proj">
            <Select id="kb-proj" options={[{ value: "", label: "Global" }, ...projectOptions]}
              value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          </Field>
          <Field label="Prioridad" htmlFor="kb-prio" error={errors.priority}>
            <Input id="kb-prio" type="number" min={0} value={priority} onChange={(e) => setPriority(e.target.value)}
              invalid={!!errors.priority} aria-describedby={errors.priority ? "kb-prio-error" : undefined} />
          </Field>
        </div>

        {tags.length > 0 && (
          <Field label="Etiquetas" htmlFor="kb-tags" error={errors.tagIds}>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border p-3">
              {tags.map((t) => (
                <Checkbox key={t.id} checked={tagIds.has(t.id)} onCheckedChange={(c) => toggleTag(t.id, c)} label={t.name} />
              ))}
            </div>
          </Field>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Entrada activa</p>
            <p className="text-xs text-muted">Las inactivas no se usan en el agente.</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Entrada activa" />
        </div>
      </form>
    </Dialog>
  );
}
