"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import {
  listKbCategories,
  createKbCategory,
  updateKbCategory,
  deleteKbCategory,
  listKbTags,
  createKbTag,
  deleteKbTag,
  KB_CATEGORY_CODE_RE,
} from "@/lib/api/kb";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import type { KbCategory, KbTag } from "@/lib/api/types";

export default function TaxonomiaPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("kb:write");
  const canDelete = can("kb:delete");

  const catFetcher = useCallback((s?: AbortSignal) => listKbCategories(s), []);
  const cats = useResource<KbCategory[]>(catFetcher, []);
  const tagFetcher = useCallback((s?: AbortSignal) => listKbTags(s), []);
  const tags = useResource<KbTag[]>(tagFetcher, []);

  // Categoría form (dialog)
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<KbCategory | null>(null);
  const [catCode, setCatCode] = useState("");
  const [catName, setCatName] = useState("");
  const [catErr, setCatErr] = useState<Record<string, string>>({});
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    if (!catOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setCatErr({});
    setCatCode(editingCat?.code ?? "");
    setCatName(editingCat?.name ?? "");
  }, [catOpen, editingCat]);

  async function saveCat(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editingCat && !KB_CATEGORY_CODE_RE.test(catCode.trim()))
      errs.code = "Solo A-Z, 0-9 y guion bajo.";
    if (!catName.trim()) errs.name = "Obligatorio.";
    setCatErr(errs);
    if (Object.keys(errs).length) return;
    setCatSaving(true);
    try {
      if (editingCat) await updateKbCategory(editingCat.id, { name: catName.trim() });
      else await createKbCategory({ code: catCode.trim().toUpperCase(), name: catName.trim() });
      toast({ tone: "success", title: editingCat ? "Categoría actualizada" : "Categoría creada" });
      setCatOpen(false);
      cats.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 409) setCatErr({ code: err.messages[0] });
      else toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
    } finally {
      setCatSaving(false);
    }
  }

  const [deletingCat, setDeletingCat] = useState<KbCategory | null>(null);
  const [catDelLoading, setCatDelLoading] = useState(false);
  async function confirmDeleteCat() {
    if (!deletingCat) return;
    setCatDelLoading(true);
    try {
      await deleteKbCategory(deletingCat.id);
      toast({ tone: "success", title: "Categoría eliminada" });
      setDeletingCat(null);
      cats.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setCatDelLoading(false);
    }
  }

  // Tags inline create
  const [newTag, setNewTag] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTag.trim()) return;
    setTagSaving(true);
    try {
      await createKbTag({ name: newTag.trim() });
      setNewTag("");
      tags.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo crear", description: errorMessage(err) });
    } finally {
      setTagSaving(false);
    }
  }
  async function removeTag(t: KbTag) {
    try {
      await deleteKbTag(t.id);
      tags.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/conocimiento" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Conocimiento
      </Link>

      <PageHeader title="Categorías y etiquetas" description="Taxonomía de la base de conocimiento." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categorías */}
        <Card>
          <CardHeader>
            <CardTitle>Categorías</CardTitle>
            {canWrite && (
              <Button size="sm" variant="secondary" onClick={() => { setEditingCat(null); setCatOpen(true); }}>
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {cats.loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : cats.error ? (
              <ErrorState error={cats.error} onRetry={cats.refetch} />
            ) : (cats.data ?? []).length === 0 ? (
              <EmptyState title="Sin categorías" />
            ) : (
              <ul className="divide-y divide-border">
                {(cats.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs"><Badge tone="neutral">{c.code}</Badge></p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canWrite && (
                        <button type="button" onClick={() => { setEditingCat(c); setCatOpen(true); }}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground" aria-label={`Editar ${c.name}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => setDeletingCat(c)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Eliminar ${c.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Etiquetas */}
        <Card>
          <CardHeader>
            <CardTitle>Etiquetas</CardTitle>
          </CardHeader>
          <CardContent>
            {canWrite && (
              <form onSubmit={addTag} className="mb-4 flex gap-2">
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nueva etiqueta" />
                <Button type="submit" variant="secondary" disabled={tagSaving} aria-busy={tagSaving}>
                  {tagSaving ? <Spinner /> : <Plus className="h-4 w-4" />}
                  Agregar
                </Button>
              </form>
            )}
            {tags.loading ? (
              <Skeleton className="h-9 w-full" />
            ) : tags.error ? (
              <ErrorState error={tags.error} onRetry={tags.refetch} />
            ) : (tags.data ?? []).length === 0 ? (
              <EmptyState title="Sin etiquetas" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(tags.data ?? []).map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-muted px-2.5 py-1 text-xs text-foreground">
                    {t.name}
                    {canDelete && (
                      <button type="button" onClick={() => removeTag(t)} className="text-subtle hover:text-danger" aria-label={`Eliminar ${t.name}`}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={catOpen}
        onClose={catSaving ? () => {} : () => setCatOpen(false)}
        title={editingCat ? "Editar categoría" : "Nueva categoría"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCatOpen(false)} disabled={catSaving}>Cancelar</Button>
            <Button type="submit" form="cat-form" size="sm" disabled={catSaving} aria-busy={catSaving}>
              {catSaving && <Spinner />}{editingCat ? "Guardar" : "Crear"}
            </Button>
          </>
        }
      >
        <form id="cat-form" onSubmit={saveCat} noValidate className="space-y-4">
          <Field label="Código" htmlFor="cat-code" required error={catErr.code}
            hint={editingCat ? "El código no se puede cambiar." : "Mayúsculas, números y guion bajo."}>
            <Input id="cat-code" value={catCode} onChange={(e) => setCatCode(e.target.value.toUpperCase())}
              invalid={!!catErr.code} disabled={!!editingCat}
              aria-describedby={catErr.code ? "cat-code-error" : "cat-code-hint"} placeholder="FINANCIAMIENTO" />
          </Field>
          <Field label="Nombre" htmlFor="cat-name" required error={catErr.name}>
            <Input id="cat-name" value={catName} onChange={(e) => setCatName(e.target.value)}
              invalid={!!catErr.name} aria-describedby={catErr.name ? "cat-name-error" : undefined} />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deletingCat}
        onClose={() => setDeletingCat(null)}
        onConfirm={confirmDeleteCat}
        loading={catDelLoading}
        title={`Eliminar "${deletingCat?.name ?? ""}"`}
        description="Las entradas con esta categoría quedarán sin categoría."
        confirmLabel="Eliminar"
      />
    </div>
  );
}
