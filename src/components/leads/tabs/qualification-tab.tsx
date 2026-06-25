"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { errorMessage } from "@/lib/api/errors";
import {
  listQualifications,
  upsertQualification,
  deleteQualification,
  type QualificationInput,
} from "@/lib/api/leads";
import { formatCurrency } from "@/lib/format";
import type { LeadQualification } from "@/lib/api/types";

interface Props {
  leadId: string;
  canWrite: boolean;
  canDelete: boolean;
}

interface FormState {
  budget_min: string;
  budget_max: string;
  currency: string;
  down_payment_capacity: string;
  monthly_payment_capacity: string;
  financing_notes: string;
  summary: string;
}

const empty: FormState = {
  budget_min: "",
  budget_max: "",
  currency: "USD",
  down_payment_capacity: "",
  monthly_payment_capacity: "",
  financing_notes: "",
  summary: "",
};

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

export function QualificationTab({ leadId, canWrite, canDelete }: Props) {
  const toast = useToast();
  const fetcher = useCallback((s?: AbortSignal) => listQualifications(leadId, s), [leadId]);
  const { data, loading, error, refetch } = useResource<LeadQualification[]>(fetcher, [leadId]);
  const current = data?.[0] ?? null;
  const cur = current?.currency ?? undefined;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setForm(
      current
        ? {
            budget_min: current.budget_min?.toString() ?? "",
            budget_max: current.budget_max?.toString() ?? "",
            currency: current.currency ?? "USD",
            down_payment_capacity: current.down_payment_capacity?.toString() ?? "",
            monthly_payment_capacity: current.monthly_payment_capacity?.toString() ?? "",
            financing_notes: current.financing_notes ?? "",
            summary: "",
          }
        : empty
    );
  }, [open, current]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const body: QualificationInput = {
      budget_min: num(form.budget_min),
      budget_max: num(form.budget_max),
      currency: form.currency.trim() || undefined,
      down_payment_capacity: num(form.down_payment_capacity),
      monthly_payment_capacity: num(form.monthly_payment_capacity),
      financing_notes: form.financing_notes.trim() || undefined,
      summary: form.summary.trim() || undefined,
    };
    try {
      await upsertQualification(leadId, body);
      toast({ tone: "success", title: "Calificación guardada" });
      setOpen(false);
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!current) return;
    setDelLoading(true);
    try {
      await deleteQualification(leadId, current.id);
      toast({ tone: "success", title: "Calificación eliminada" });
      setConfirmDel(false);
      refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calificación financiera</CardTitle>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4" />
            {current ? "Editar" : "Agregar"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !current ? (
          <EmptyState title="Sin calificación" description="Aún no se calificó este lead." />
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Item
                label="Presupuesto"
                value={
                  current.budget_min != null || current.budget_max != null
                    ? `${formatCurrency(current.budget_min ?? "0", cur)} – ${formatCurrency(
                        current.budget_max ?? "0",
                        cur
                      )}`
                    : "—"
                }
              />
              <Item
                label="Capacidad inicial"
                value={
                  current.down_payment_capacity != null
                    ? formatCurrency(current.down_payment_capacity, cur)
                    : "—"
                }
              />
              <Item
                label="Cuota mensual"
                value={
                  current.monthly_payment_capacity != null
                    ? formatCurrency(current.monthly_payment_capacity, cur)
                    : "—"
                }
              />
              <Item label="Notas" value={current.financing_notes ?? "—"} />
            </dl>
            {canDelete && (
              <Button size="sm" variant="outline" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4 text-danger" />
                <span className="text-danger">Eliminar</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onClose={submitting ? () => {} : () => setOpen(false)}
        title="Calificación financiera"
        description="Datos de capacidad de pago del lead."
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="qual-form" size="sm" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner />}
              Guardar
            </Button>
          </>
        }
      >
        <form id="qual-form" onSubmit={save} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Presupuesto mín." htmlFor="q-min">
              <Input id="q-min" type="number" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} placeholder="35000" />
            </Field>
            <Field label="Presupuesto máx." htmlFor="q-max">
              <Input id="q-max" type="number" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} placeholder="50000" />
            </Field>
            <Field label="Moneda" htmlFor="q-cur">
              <Input id="q-cur" maxLength={3} value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} placeholder="USD" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Capacidad inicial" htmlFor="q-down">
              <Input id="q-down" type="number" value={form.down_payment_capacity} onChange={(e) => set("down_payment_capacity", e.target.value)} placeholder="5000" />
            </Field>
            <Field label="Capacidad cuota mensual" htmlFor="q-month">
              <Input id="q-month" type="number" value={form.monthly_payment_capacity} onChange={(e) => set("monthly_payment_capacity", e.target.value)} placeholder="350" />
            </Field>
          </div>
          <Field label="Notas de financiamiento" htmlFor="q-notes">
            <Textarea id="q-notes" value={form.financing_notes} onChange={(e) => set("financing_notes", e.target.value)} placeholder="Trabaja en España, puede dar $5000 de inicial." />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        loading={delLoading}
        title="Eliminar calificación"
        confirmLabel="Eliminar"
      />
    </Card>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
