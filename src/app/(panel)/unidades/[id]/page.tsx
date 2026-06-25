"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UnitForm } from "@/components/units/unit-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getUnit, deleteUnit, changeUnitStatus } from "@/lib/api/units";
import { getUnitFinancingOptions } from "@/lib/api/financing";
import { UnitFinancingOptionsDialog } from "@/components/units/unit-financing-options-dialog";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { safeImageUrl } from "@/lib/utils";
import {
  UNIT_TYPE_LABELS,
  UNIT_STATUS_META,
  UNIT_ACTION_META,
  ALLOWED_UNIT_ACTIONS,
  FINANCING_TYPE_LABELS,
  labelFor,
} from "@/lib/constants";
import type { Unit, UnitAction, FinancingPlan } from "@/lib/api/types";

const ACTION_VARIANT: Record<UnitAction, ButtonProps["variant"]> = {
  reserve: "secondary",
  sell: "primary",
  block: "danger",
  release: "secondary",
};

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

function decimal(value: string | null, suffix = ""): string {
  if (!value) return "—";
  const n = parseFloat(value);
  return Number.isNaN(n) ? "—" : `${formatNumber(n)}${suffix}`;
}

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("projects:write");
  const canDelete = can("projects:delete");
  const canReadFinancing = can("financing-plans:read");
  const canFinancingWrite = can("financing-options:write");

  const fetchUnit = useCallback(
    (signal?: AbortSignal) => getUnit(id, signal),
    [id]
  );
  const { data: unit, loading, error, refetch, mutate } = useResource<Unit>(
    fetchUnit,
    [id]
  );

  const fetchOptions = useCallback(
    (signal?: AbortSignal) =>
      canReadFinancing
        ? getUnitFinancingOptions(id, signal)
        : Promise.resolve([] as FinancingPlan[]),
    [id, canReadFinancing]
  );
  const options = useResource<FinancingPlan[]>(fetchOptions, [id, canReadFinancing]);

  const [formOpen, setFormOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<UnitAction | null>(null);
  // Acciones "de peso" (vender/bloquear) piden confirmación.
  const [pendingAction, setPendingAction] = useState<UnitAction | null>(null);

  async function runAction(action: UnitAction) {
    if (!unit) return;
    setActionLoading(action);
    try {
      const updated = await changeUnitStatus(unit.id, action);
      mutate(updated);
      toast({
        tone: "success",
        title: `Unidad ${UNIT_ACTION_META[action].label.toLowerCase()}`,
        description: `${updated.code} · ${
          UNIT_STATUS_META[updated.status]?.label ?? updated.status
        }`,
      });
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: "Unidad no encontrada" });
        refetch();
      } else {
        toast({
          tone: "error",
          title: "No se pudo cambiar el estado",
          description: errorMessage(err),
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmDelete() {
    if (!unit) return;
    setDeleteLoading(true);
    try {
      const res = await deleteUnit(unit.id);
      toast({ tone: "success", title: res.message });
      router.push(`/proyectos/${unit.projectId}/unidades`);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La unidad ya no existe." });
        router.push(`/proyectos/${unit.projectId}/unidades`);
        return;
      }
      toast({
        tone: "error",
        title: "No se pudo eliminar",
        description: errorMessage(err),
      });
      setDeleteLoading(false);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={unit ? `/proyectos/${unit.projectId}/unidades` : "/proyectos"}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {unit ? "Unidades del proyecto" : "Proyectos"}
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
              description="Es posible que haya sido eliminada."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/proyectos")}
                >
                  Volver a proyectos
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : unit ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {unit.code}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{labelFor(UNIT_TYPE_LABELS, unit.type)}</Badge>
                <Badge tone={UNIT_STATUS_META[unit.status]?.tone ?? "neutral"} dot>
                  {UNIT_STATUS_META[unit.status]?.label ?? unit.status}
                </Badge>
              </div>
            </div>

            {(canWrite || canDelete) && (
              <div className="flex items-center gap-2">
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

          {/* Galería de fotos */}
          {unit.imgUrl && unit.imgUrl.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fotos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-2">
                  {unit.imgUrl.map((url, i) => (
                    <li key={`${url}-${i}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={safeImageUrl(url) || url}
                        alt={`Foto ${i + 1} de ${unit.code}`}
                        className="h-28 w-28 rounded-lg border border-border object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Acciones de estado */}
          {canWrite && (ALLOWED_UNIT_ACTIONS[unit.status] ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cambiar estado</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(ALLOWED_UNIT_ACTIONS[unit.status] ?? []).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={ACTION_VARIANT[action]}
                    disabled={actionLoading !== null}
                    aria-busy={actionLoading === action}
                    onClick={() =>
                      action === "sell" || action === "block"
                        ? setPendingAction(action)
                        : runAction(action)
                    }
                  >
                    {actionLoading === action && <Spinner />}
                    {UNIT_ACTION_META[action].label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row
                  label="Precio"
                  value={formatCurrency(unit.price, unit.currency)}
                />
                <Row label="Área" value={decimal(unit.areaM2, " m²")} />
                {unit.type === "VIVIENDA" ? (
                  <>
                    <Row label="Dormitorios" value={unit.bedrooms ?? "—"} />
                    <Row label="Baños" value={unit.bathrooms ?? "—"} />
                    <Row
                      label="Superficie construida"
                      value={decimal(unit.builtAreaM2, " m²")}
                    />
                  </>
                ) : (
                  <>
                    <Row label="Frente" value={decimal(unit.frontageM, " m")} />
                    <Row label="Fondo" value={decimal(unit.depthM, " m")} />
                  </>
                )}
                <Row
                  label="Servicios"
                  value={
                    unit.hasUtilities === null
                      ? "—"
                      : unit.hasUtilities
                        ? "Sí"
                        : "No"
                  }
                />
                <Row label="Ubicación" value={unit.location ?? "—"} />
                <Row label="Dirección" value={unit.address1 ?? "—"} />
                <Row label="Referencias" value={unit.references ?? "—"} />
                <Row label="Plan de financiamiento" value={unit.financingPlanId ?? "—"} />
                <Row label="Creada" value={formatDate(unit.createdAt)} />
                <Row
                  label="Última actualización"
                  value={formatDateTime(unit.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          {canReadFinancing && (
            <Card>
              <CardHeader>
                <CardTitle>Opciones de financiamiento</CardTitle>
                {canFinancingWrite && (
                  <Button size="sm" variant="secondary" onClick={() => setOptionsOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    Editar opciones
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {options.loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : options.error ? (
                  <ErrorState error={options.error} onRetry={options.refetch} />
                ) : (options.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted">Sin planes asociados.</p>
                ) : (
                  <ul className="space-y-2">
                    {options.data!.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Badge tone="neutral">{labelFor(FINANCING_TYPE_LABELS, p.type)}</Badge>
                          {!p.isActive && <Badge tone="warning">Inactivo</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <UnitForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            projectId={unit.projectId}
            unit={unit}
            onSaved={(u) => mutate(u)}
            onNotFound={() => router.push(`/proyectos/${unit.projectId}/unidades`)}
          />

          {canFinancingWrite && (
            <UnitFinancingOptionsDialog
              open={optionsOpen}
              unitId={unit.id}
              unitCode={unit.code}
              onClose={() => setOptionsOpen(false)}
              onSaved={(plans) => options.mutate(plans)}
              onUnitGone={() => router.push(`/proyectos/${unit.projectId}/unidades`)}
            />
          )}

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar unidad "${unit.code}"`}
            description="La unidad dejará de aparecer en el listado."
            confirmLabel="Eliminar"
          />

          <ConfirmDialog
            open={pendingAction === "sell" || pendingAction === "block"}
            onClose={() => setPendingAction(null)}
            onConfirm={() => {
              const a = pendingAction;
              setPendingAction(null);
              if (a) runAction(a);
            }}
            loading={actionLoading !== null}
            tone={pendingAction === "block" ? "danger" : "primary"}
            title={
              pendingAction === "sell"
                ? `Vender unidad "${unit.code}"`
                : `Bloquear unidad "${unit.code}"`
            }
            description={
              pendingAction === "sell"
                ? "La unidad pasará a VENDIDO. ¿Confirmas la venta?"
                : "La unidad pasará a BLOQUEADO y no estará disponible."
            }
            confirmLabel={pendingAction === "sell" ? "Vender" : "Bloquear"}
          />
        </>
      ) : null}
    </div>
  );
}
