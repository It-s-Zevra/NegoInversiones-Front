"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { getSale, deleteSale } from "@/lib/api/sales";
import { listProjects } from "@/lib/api/projects";
import { getLead } from "@/lib/api/leads";
import { listUsers } from "@/lib/api/users";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { SALE_STATUS_META } from "@/lib/constants";
import type { Lead, Paginated, Project, Sale, User } from "@/lib/api/types";

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

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();
  const { can, user } = useAuth();
  const isManager = user?.role === "ADMIN" || user?.role === "JEFE_COMERCIAL";
  const canManage = isManager && can("sales:write");

  const fetchSale = useCallback(
    (signal?: AbortSignal) => getSale(id, signal),
    [id]
  );
  const { data: sale, loading, error, refetch } = useResource<Sale>(
    fetchSale,
    [id]
  );

  const fetchProjects = useCallback(
    (signal?: AbortSignal) =>
      listProjects(
        { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" },
        signal
      ),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(
    fetchProjects,
    []
  );
  const projects = useMemo(() => projectsPage?.data ?? [], [projectsPage]);
  const projectName = (pid: string) =>
    projects.find((p) => p.id === pid)?.name ?? `Proyecto #${pid}`;

  // Resolver nombres legibles (lead + ejecutivo) en vez de ids crudos.
  const leadId = sale?.leadId;
  const fetchLead = useCallback(
    (signal?: AbortSignal) => (leadId ? getLead(leadId, signal) : Promise.resolve(null)),
    [leadId]
  );
  const { data: lead } = useResource<Lead | null>(fetchLead, [leadId]);
  const leadName = lead ? (lead.full_name ?? lead.phone) : sale?.leadId;

  const fetchUsers = useCallback(
    (signal?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, signal),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(fetchUsers, []);
  const execName = (uid: string | null | undefined) => {
    if (!uid) return "—";
    const u = (usersPage?.data ?? []).find((x) => x.id === uid);
    return u ? `${u.firstName} ${u.lastName}` : `#${uid}`;
  };

  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!sale) return;
    setDeleteLoading(true);
    try {
      const res = await deleteSale(sale.id);
      toast({ tone: "success", title: res.message });
      router.push("/ventas");
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La venta ya no existe." });
        router.push("/ventas");
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
        href="/ventas"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Ventas
      </Link>

      {loading ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-28" />
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
              description="Es posible que haya sido eliminada."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push("/ventas")}
                >
                  Volver a ventas
                </Button>
              }
            />
          ) : (
            <ErrorState error={error} onRetry={refetch} />
          )}
        </Card>
      ) : sale ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Venta #{sale.id}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={SALE_STATUS_META[sale.status]?.tone ?? "neutral"} dot>
                  {SALE_STATUS_META[sale.status]?.label ?? sale.status}
                </Badge>
                <span className="text-sm text-muted">
                  {formatCurrency(sale.totalPrice, sale.currency)}
                </span>
              </div>
            </div>

            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/ventas/${sale.id}/editar`)}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button variant="outline" onClick={() => setDeleting(true)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                  <span className="text-danger">Eliminar</span>
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row
                  label="Proyecto"
                  value={
                    <Link
                      href={`/proyectos/${sale.projectId}`}
                      className="text-primary hover:underline"
                    >
                      {projectName(sale.projectId)}
                    </Link>
                  }
                />
                <Row
                  label="Unidad"
                  value={
                    sale.unitId ? (
                      <Link
                        href={`/unidades/${sale.unitId}`}
                        className="text-primary hover:underline"
                      >
                        Unidad #{sale.unitId}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  label="Lead"
                  value={
                    <Link
                      href={`/leads/${sale.leadId}`}
                      className="text-primary hover:underline"
                    >
                      {leadName}
                    </Link>
                  }
                />
                <Row label="Ejecutivo" value={execName(sale.executiveId)} />
                <Row
                  label="Precio total"
                  value={formatCurrency(sale.totalPrice, sale.currency)}
                />
                <Row
                  label="Cuota inicial"
                  value={
                    sale.downPayment
                      ? formatCurrency(sale.downPayment, sale.currency)
                      : "—"
                  }
                />
                <Row label="Fecha de contrato" value={formatDate(sale.contractDate)} />
                <Row
                  label="Plazo"
                  value={
                    sale.financingTermMonths != null
                      ? `${formatNumber(sale.financingTermMonths)} meses`
                      : "—"
                  }
                />
                <Row
                  label="Tasa de interés"
                  value={sale.interestRate != null ? `${sale.interestRate}%` : "—"}
                />
                <Row label="Acuerdos" value={sale.agreements ?? "—"} />
                <Row label="Registrada" value={formatDate(sale.createdAt)} />
                <Row
                  label="Última actualización"
                  value={formatDateTime(sale.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            onConfirm={confirmDelete}
            loading={deleteLoading}
            title={`Eliminar venta #${sale.id}`}
            description="La venta dejará de aparecer en el historial."
            confirmLabel="Eliminar"
          />
        </>
      ) : null}
    </div>
  );
}
