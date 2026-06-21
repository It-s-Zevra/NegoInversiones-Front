"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ScheduleEditor } from "@/components/agendas/schedule-editor";
import { ExceptionForm } from "@/components/agendas/exception-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listUsers } from "@/lib/api/users";
import {
  executivesAvailability,
  listUserExceptions,
  approveException,
  rejectException,
  deleteException,
} from "@/lib/api/schedules";
import { errorMessage } from "@/lib/api/errors";
import {
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_STATUS_META,
  EXCEPTION_EFFECT_LABELS,
  DAY_OF_WEEK_LABELS,
  labelFor,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type {
  AvailabilityException,
  ExecutivesAvailability,
  Paginated,
  User,
} from "@/lib/api/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AgendasPage() {
  const toast = useToast();
  const { user, can } = useAuth();
  const canWrite = can("schedules:write");

  // Usuarios para el selector
  const usersFetcher = useCallback(
    (s?: AbortSignal) =>
      listUsers({ page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" }, s),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(usersFetcher, []);
  const userOptions = useMemo(
    () => (usersPage?.data ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    [usersPage]
  );

  // Las páginas del panel solo renderizan ya autenticadas (sin SSR de contenido),
  // por eso es seguro inicializar con el usuario actual y fechas del cliente.
  const [selectedUser, setSelectedUser] = useState(() => user?.id ?? "");
  const [from, setFrom] = useState(() => iso(new Date()));
  const [to, setTo] = useState(() => iso(new Date(Date.now() + 6 * 86400000)));

  const execFetcher = useCallback(
    (s?: AbortSignal) => executivesAvailability({ from, to }, s),
    [from, to]
  );
  const exec = useResource<ExecutivesAvailability>(execFetcher, [from, to]);

  const excFetcher = useCallback(
    (s?: AbortSignal) =>
      selectedUser
        ? listUserExceptions(selectedUser, { page: 1, limit: 50, sortOrder: "DESC" }, s)
        : Promise.resolve({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1 } }),
    [selectedUser]
  );
  const exc = useResource<Paginated<AvailabilityException>>(excFetcher, [selectedUser]);

  const [excFormOpen, setExcFormOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setActionId(id);
    try {
      if (action === "approve") await approveException(id);
      else await rejectException(id);
      toast({ tone: "success", title: action === "approve" ? "Excepción aprobada" : "Excepción rechazada" });
      exc.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo procesar", description: errorMessage(err) });
    } finally {
      setActionId(null);
    }
  }
  async function removeExc(id: string) {
    setActionId(id);
    try {
      await deleteException(id);
      toast({ tone: "success", title: "Excepción eliminada" });
      exc.refetch();
    } catch (err) {
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Agendas" description="Disponibilidad de ejecutivos y excepciones." />

      {/* Disponibilidad de ejecutivos */}
      <Card>
        <CardHeader>
          <CardTitle>Disponibilidad de ejecutivos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
            <Field label="Desde" htmlFor="ex-from">
              <Input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="ex-to">
              <Input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>

          {exec.loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : exec.error ? (
            <ErrorState error={exec.error} onRetry={exec.refetch} />
          ) : (exec.data?.executives.length ?? 0) === 0 ? (
            <EmptyState title="Sin datos" description="No hay disponibilidad en el rango." />
          ) : (
            <ul className="divide-y divide-border">
              {exec.data!.executives.map((ex) => {
                const days = ex.days.filter((d) => d.available);
                return (
                  <li key={ex.executiveId} className="py-3">
                    <p className="text-sm font-medium text-foreground">{ex.executiveName}</p>
                    {days.length === 0 ? (
                      <p className="mt-1 text-xs text-muted">Sin disponibilidad</p>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {days.map((d) => (
                          <span key={d.date} className="rounded-md border border-border bg-surface-muted px-2 py-1 text-xs text-muted">
                            {DAY_OF_WEEK_LABELS[d.dayOfWeek]?.slice(0, 3)} {formatDate(d.date)} ·{" "}
                            {d.windows.map((w) => `${w.start}–${w.end}`).join(", ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Gestión por usuario */}
      <div className="grid grid-cols-1 gap-3 sm:max-w-sm">
        <Field label="Usuario" htmlFor="ag-user">
          <Select id="ag-user" options={userOptions} placeholder="Selecciona un usuario"
            value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} />
        </Field>
      </div>

      {selectedUser && (
        <>
          <ScheduleEditor userId={selectedUser} canWrite={canWrite} />

          <Card>
            <CardHeader>
              <CardTitle>Excepciones de disponibilidad</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setExcFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva excepción
              </Button>
            </CardHeader>
            <CardContent>
              {exc.loading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : exc.error ? (
                <ErrorState error={exc.error} onRetry={exc.refetch} />
              ) : (exc.data?.data.length ?? 0) === 0 ? (
                <EmptyState title="Sin excepciones" />
              ) : (
                <ul className="divide-y divide-border">
                  {exc.data!.data.map((e) => (
                    <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">
                            {labelFor(EXCEPTION_TYPE_LABELS, e.type)}
                          </span>
                          <Badge tone={EXCEPTION_STATUS_META[e.status]?.tone ?? "neutral"} dot>
                            {EXCEPTION_STATUS_META[e.status]?.label ?? e.status}
                          </Badge>
                          {e.userId === null && <Badge tone="info">Empresa</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(e.startDate)} – {formatDate(e.endDate)} ·{" "}
                          {labelFor(EXCEPTION_EFFECT_LABELS, e.effect)}
                          {!e.isAllDay && e.startTime && e.endTime ? ` · ${e.startTime}–${e.endTime}` : ""}
                          {e.reason ? ` · ${e.reason}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {e.status === "PENDIENTE" && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => decide(e.id, "approve")}
                              disabled={actionId === e.id} aria-busy={actionId === e.id}>
                              <Check className="h-4 w-4 text-success" />
                              Aprobar
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => decide(e.id, "reject")}
                              disabled={actionId === e.id}>
                              <X className="h-4 w-4 text-danger" />
                              Rechazar
                            </Button>
                          </>
                        )}
                        {e.userId !== null && (
                          <button type="button" onClick={() => removeExc(e.id)} disabled={actionId === e.id}
                            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                            aria-label="Eliminar excepción">
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

          <ExceptionForm
            open={excFormOpen}
            onClose={() => setExcFormOpen(false)}
            userId={selectedUser}
            onSaved={() => exc.refetch()}
          />
        </>
      )}
    </div>
  );
}
