"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Power, PowerOff, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FinancingPlanForm } from "@/components/financing/financing-plan-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getFinancingPlan,
  deleteFinancingPlan,
  activateFinancingPlan,
  deactivateFinancingPlan,
  cloneFinancingPlan,
} from "@/lib/api/financing";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  FINANCING_TYPE_LABELS,
  DOWN_PAYMENT_TYPE_LABELS,
  FREQUENCY_LABELS,
  labelFor,
} from "@/lib/constants";
import type { FinancingPlan } from "@/lib/api/types";

type Action = "toggle" | "clone";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  );
}

function pct(value: string | null): string {
  if (value == null) return "—";
  const n = parseFloat(value);
  return Number.isNaN(n) ? "—" : `${formatNumber(n)}%`;
}

export default function FinancingPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const canWrite = can("financing-plans:write");
  const canDelete = user?.role === "ADMIN";

  const fetchPlan = useCallback(
    (signal?: AbortSignal) => getFinancingPlan(id, signal),
    [id]
  );
  const { data: plan, loading, error, refetch, mutate } =
    useResource<FinancingPlan>(fetchPlan, [id]);

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Action | null>(null);

  // La página no se desmonta al navegar entre planes (mismo segmento [id]).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset de flag transitorio al cambiar de plan
    setActionLoading(null);
  }, [id]);

  async function toggleActive() {
    if (!plan) return;
    setActionLoading("toggle");
    try {
      const updated = plan.isActive
        ? await deactivateFinancingPlan(plan.id)
        : await activateFinancingPlan(plan.id);
      mutate(updated);
      toast({
        tone: "success",
        title: updated.isActive ? "Plan activado" : "Plan desactivado",
      });
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: "Plan de financiamiento no encontrado" });
        refetch();
      } else {
        toast({ tone: "error", title: "No se pudo cambiar el estado", description: errorMessage(err) });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function clonePlan() {
    if (!plan) return;
    setActionLoading("clone");
    try {
      const copy = await cloneFinancingPlan(plan.id);
      toast({ tone: "success", title: "Plan clonado", description: copy.name });
      // La ruta /financiamiento/[id] no se desmonta al navegar; resetear el estado.
      setActionLoading(null);
      router.push(`/financiamiento/${copy.id}`);
    } catch (err) {
      toast({ tone: "error", title: "No se pudo clonar", description: errorMessage(err) });
      setActionLoading(null);
    }
  }

  async function confirmDelete() {
    if (!plan) return;
    setDeleteLoading(true);
    try {
      const res = await deleteFinancingPlan(plan.id);
      toast({ tone: "success", title: res.message });
      router.push("/financiamiento");
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El plan ya no existe." });
        router.push("/financiamiento");
        return;
      }
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  function downPaymentValue(p: FinancingPlan): string {
    if (p.downPaymentType === "FIXED")
      return formatCurrency(p.downPaymentRequired, p.currency);
    if (p.downPaymentType === "PERCENT") return pct(p.downPaymentPercent);
    return "Sin anticipo";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/financiamiento"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Financiamiento
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          {error.statusCode === 404 ? (
            <EmptyState
              title={errorMessage(error)}
              description="Es posible que haya sido eliminado."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/financiamiento")}
                >
                  Volver a financiamiento
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : plan ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {plan.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="primary">{labelFor(FINANCING_TYPE_LABELS, plan.type)}</Badge>
                {plan.isActive ? (
                  <Badge tone="success" dot>
                    Activo
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    Inactivo
                  </Badge>
                )}
              </div>
            </div>

            {(canWrite || canDelete) && (
              <div className="flex flex-wrap items-center gap-2">
                {canWrite && (
                  <Button
                    variant="secondary"
                    onClick={toggleActive}
                    disabled={actionLoading !== null}
                    aria-busy={actionLoading === "toggle"}
                  >
                    {actionLoading === "toggle" ? (
                      <Spinner />
                    ) : plan.isActive ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {plan.isActive ? "Desactivar" : "Activar"}
                  </Button>
                )}
                {canWrite && (
                  <Button
                    variant="secondary"
                    onClick={clonePlan}
                    disabled={actionLoading !== null}
                    aria-busy={actionLoading === "clone"}
                  >
                    {actionLoading === "clone" ? <Spinner /> : <Copy className="h-4 w-4" />}
                    Clonar
                  </Button>
                )}
                {canWrite && (
                  <Button variant="secondary" onClick={() => setFormOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                    <span className="text-danger">Eliminar</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Condiciones</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Descripción" value={plan.description ?? "—"} />
                <Row label="Moneda" value={plan.currency} />
                <Row
                  label="Anticipo"
                  value={`${labelFor(DOWN_PAYMENT_TYPE_LABELS, plan.downPaymentType)}${
                    plan.downPaymentType === "NONE" ? "" : ` · ${downPaymentValue(plan)}`
                  }`}
                />
                <Row
                  label="Cuotas"
                  value={
                    plan.installmentsCount != null
                      ? `${formatNumber(plan.installmentsCount)} × ${labelFor(FREQUENCY_LABELS, plan.frequency)}`
                      : "—"
                  }
                />
                <Row
                  label="Monto de cuota"
                  value={
                    plan.installmentAmount
                      ? formatCurrency(plan.installmentAmount, plan.currency)
                      : "—"
                  }
                />
                <Row
                  label="Plazo"
                  value={
                    plan.termMonths != null
                      ? `${formatNumber(plan.termMonths)} meses`
                      : "—"
                  }
                />
                <Row label="Tasa de interés" value={pct(plan.interestRate)} />
                <Row label="Descuento al contado" value={pct(plan.cashDiscountPercent)} />
                <Row
                  label="Monto mínimo"
                  value={
                    plan.minAmount
                      ? formatCurrency(plan.minAmount, plan.currency)
                      : "—"
                  }
                />
                <Row label="Creado" value={formatDate(plan.createdAt)} />
                <Row
                  label="Última actualización"
                  value={formatDateTime(plan.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <FinancingPlanForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            plan={plan}
            onSaved={(p) => mutate(p)}
            onNotFound={() => router.push("/financiamiento")}
          />

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar "${plan.name}"`}
            description="El plan dejará de aparecer en el catálogo."
            confirmLabel="Eliminar"
          />
        </>
      ) : null}
    </div>
  );
}
