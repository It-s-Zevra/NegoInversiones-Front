"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Copy,
  Wallet,
  HandCoins,
  CalendarRange,
  Receipt,
  Percent,
  Tag,
  CalendarDays,
  Clock,
} from "lucide-react";
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

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="sm:max-w-[55%]">
        <dt className="text-sm text-muted">{label}</dt>
        {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
      </div>
      <dd className="text-sm font-medium text-foreground sm:text-right">
        {value}
      </dd>
    </div>
  );
}

/** Tile destacado para el resumen comercial del plan. */
function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface-muted/40 p-4">
      <div className="flex items-center gap-2 text-subtle">
        <Icon className="h-4 w-4" aria-hidden />
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
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
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-card" />
            ))}
          </div>
          <Card>
            <CardContent className="space-y-3 pt-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
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
                <Badge tone="neutral">{plan.currency}</Badge>
              </div>
              {plan.description ? (
                <p className="mt-3 max-w-prose text-sm text-muted">
                  {plan.description}
                </p>
              ) : null}
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

          {/* Resumen comercial: lo más importante, de un vistazo */}
          <section aria-label="Resumen del plan">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Tile
                icon={Wallet}
                label="Tipo de plan"
                value={labelFor(FINANCING_TYPE_LABELS, plan.type)}
                hint="Cómo paga el cliente este plan."
              />
              <Tile
                icon={HandCoins}
                label="Anticipo"
                value={
                  plan.downPaymentType === "NONE"
                    ? "Sin anticipo"
                    : downPaymentValue(plan)
                }
                hint={
                  plan.downPaymentType === "NONE"
                    ? "No se pide pago inicial."
                    : `Pago inicial: ${labelFor(DOWN_PAYMENT_TYPE_LABELS, plan.downPaymentType).toLowerCase()}.`
                }
              />
              <Tile
                icon={Receipt}
                label="Cuotas"
                value={
                  plan.installmentsCount != null
                    ? `${formatNumber(plan.installmentsCount)} cuotas`
                    : "Sin definir"
                }
                hint={
                  plan.installmentAmount
                    ? `${formatCurrency(plan.installmentAmount, plan.currency)} ${labelFor(FREQUENCY_LABELS, plan.frequency).toLowerCase()}`
                    : `Frecuencia ${labelFor(FREQUENCY_LABELS, plan.frequency).toLowerCase()}`
                }
              />
              <Tile
                icon={CalendarRange}
                label="Plazo"
                value={
                  plan.termMonths != null
                    ? `${formatNumber(plan.termMonths)} meses`
                    : "Sin definir"
                }
                hint="Tiempo total para terminar de pagar."
              />
              <Tile
                icon={Percent}
                label="Interés"
                value={pct(plan.interestRate)}
                hint="Recargo aplicado al financiar."
              />
              <Tile
                icon={Tag}
                label="Descuento al contado"
                value={pct(plan.cashDiscountPercent)}
                hint="Rebaja si paga todo de una vez."
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Detalle de pago */}
            <Card>
              <CardHeader>
                <CardTitle>Cómo se paga</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row
                    label="Anticipo"
                    hint="Pago inicial antes de las cuotas."
                    value={`${labelFor(DOWN_PAYMENT_TYPE_LABELS, plan.downPaymentType)}${
                      plan.downPaymentType === "NONE" ? "" : ` · ${downPaymentValue(plan)}`
                    }`}
                  />
                  <Row
                    label="Cantidad de cuotas"
                    value={
                      plan.installmentsCount != null
                        ? `${formatNumber(plan.installmentsCount)} × ${labelFor(FREQUENCY_LABELS, plan.frequency)}`
                        : "—"
                    }
                  />
                  <Row
                    label="Monto de cada cuota"
                    value={
                      plan.installmentAmount
                        ? formatCurrency(plan.installmentAmount, plan.currency)
                        : "—"
                    }
                  />
                  <Row
                    label="Plazo total"
                    value={
                      plan.termMonths != null
                        ? `${formatNumber(plan.termMonths)} meses`
                        : "—"
                    }
                  />
                </dl>
              </CardContent>
            </Card>

            {/* Costos y condiciones */}
            <Card>
              <CardHeader>
                <CardTitle>Costos y requisitos</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Moneda" value={plan.currency} />
                  <Row
                    label="Tasa de interés"
                    hint="Recargo por financiar el saldo."
                    value={pct(plan.interestRate)}
                  />
                  <Row
                    label="Descuento al contado"
                    hint="Si paga todo de una vez."
                    value={pct(plan.cashDiscountPercent)}
                  />
                  <Row
                    label="Monto mínimo"
                    hint="Importe desde el que aplica este plan."
                    value={
                      plan.minAmount ? (
                        formatCurrency(plan.minAmount, plan.currency)
                      ) : (
                        <span className="text-subtle">Sin mínimo</span>
                      )
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Datos del registro */}
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 pt-5 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2 text-muted">
                <CalendarDays className="h-4 w-4 text-subtle" aria-hidden />
                <span>Creado el</span>
                <span className="font-medium text-foreground">
                  {formatDate(plan.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted sm:justify-end">
                <Clock className="h-4 w-4 text-subtle" aria-hidden />
                <span>Última actualización</span>
                <span className="font-medium text-foreground">
                  {formatDateTime(plan.updatedAt)}
                </span>
              </div>
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
