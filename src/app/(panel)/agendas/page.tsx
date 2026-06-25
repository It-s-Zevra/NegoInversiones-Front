"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Plus,
  Upload,
  Pencil,
  Check,
  X,
  Trash2,
  Users,
  CalendarDays,
  Clock,
  CalendarCheck,
  CalendarX,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ScheduleEditor } from "@/components/agendas/schedule-editor";
import { ExceptionForm } from "@/components/agendas/exception-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CsvImportDialog } from "@/components/ui/csv-import-dialog";
import { schedulesImporter } from "@/lib/api/csv-import";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listUsers } from "@/lib/api/users";
import {
  executivesAvailability,
  userAvailability,
  listUserExceptions,
  approveException,
  rejectException,
  deleteException,
} from "@/lib/api/schedules";
import { errorMessage } from "@/lib/api/errors";
import { ApiException } from "@/lib/api/http";
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
  AvailabilityExceptionStatus,
  AvailabilityExceptionType,
  AvailabilityResolution,
  ExecutivesAvailability,
  Paginated,
  User,
} from "@/lib/api/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const EXC_STATUS_FILTER = [
  { value: "", label: "Todos los estados" },
  ...(Object.keys(EXCEPTION_STATUS_META) as AvailabilityExceptionStatus[]).map(
    (s) => ({ value: s, label: EXCEPTION_STATUS_META[s].label })
  ),
];
const EXC_TYPE_FILTER = [
  { value: "", label: "Todos los tipos" },
  ...(Object.keys(EXCEPTION_TYPE_LABELS) as AvailabilityExceptionType[]).map(
    (t) => ({ value: t, label: EXCEPTION_TYPE_LABELS[t] })
  ),
];

/** HH:MM:SS / HH:MM → HH:MM para mostrar. */
const hm = (t: string) => t.slice(0, 5);

export default function AgendasPage() {
  const toast = useToast();
  const { user } = useAuth();

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
  const [execFilter, setExecFilter] = useState("");
  const [excStatus, setExcStatus] = useState("");
  const [excType, setExcType] = useState("");
  const [availDate, setAvailDate] = useState(() => iso(new Date()));

  // El backend autoriza GET/PUT del horario por propiedad (editar el propio)
  // o por rol ADMIN/JEFE_COMERCIAL — no es un permiso fino.
  const isPrivileged = user?.role === "ADMIN" || user?.role === "JEFE_COMERCIAL";
  const canWrite = isPrivileged || (!!user?.id && selectedUser === user.id);
  // Aprobar/rechazar es @Roles(ADMIN, JEFE_COMERCIAL).
  const canDecide = user?.role === "ADMIN" || user?.role === "JEFE_COMERCIAL";

  const rangeError = useMemo(() => {
    if (!from || !to) return null;
    if (to < from) return 'La fecha "Hasta" debe ser igual o posterior a "Desde".';
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    if (days > 92) return "El rango no puede superar los 92 días.";
    return null;
  }, [from, to]);

  const execFetcher = useCallback(
    (s?: AbortSignal) =>
      rangeError
        ? Promise.resolve({ from, to, executives: [] })
        : executivesAvailability(
            { from, to, executiveId: execFilter || undefined },
            s
          ),
    [from, to, rangeError, execFilter]
  );
  const exec = useResource<ExecutivesAvailability>(execFetcher, [
    from,
    to,
    rangeError,
    execFilter,
  ]);

  const excFetcher = useCallback(
    (s?: AbortSignal) =>
      selectedUser
        ? listUserExceptions(
            selectedUser,
            {
              page: 1,
              limit: 50,
              sortOrder: "DESC",
              ...(excStatus ? { status: excStatus } : {}),
              ...(excType ? { type: excType } : {}),
            },
            s
          )
        : Promise.resolve({ data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1 } }),
    [selectedUser, excStatus, excType]
  );
  const exc = useResource<Paginated<AvailabilityException>>(excFetcher, [
    selectedUser,
    excStatus,
    excType,
  ]);

  const availFetcher = useCallback(
    (s?: AbortSignal) =>
      selectedUser && availDate
        ? userAvailability(selectedUser, availDate, s)
        : Promise.resolve(null),
    [selectedUser, availDate]
  );
  const avail = useResource<AvailabilityResolution | null>(availFetcher, [
    selectedUser,
    availDate,
  ]);

  const [excFormOpen, setExcFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingExc, setEditingExc] = useState<AvailabilityException | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deletingExc, setDeletingExc] = useState<AvailabilityException | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function decide(id: string, action: "approve" | "reject") {
    setActionId(id);
    try {
      if (action === "approve") await approveException(id);
      else await rejectException(id);
      toast({ tone: "success", title: action === "approve" ? "Excepción aprobada" : "Excepción rechazada" });
      exc.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La excepción ya no existe." });
        exc.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo procesar", description: errorMessage(err) });
      }
    } finally {
      setActionId(null);
    }
  }
  async function removeExc() {
    if (!deletingExc) return;
    setDeleteLoading(true);
    try {
      await deleteException(deletingExc.id);
      toast({ tone: "success", title: "Excepción eliminada" });
      setDeletingExc(null);
      exc.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "La excepción ya no existe." });
        setDeletingExc(null);
        exc.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(err) });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendas"
        description="Gestiona la disponibilidad de los ejecutivos, sus horarios y las excepciones."
        actions={
          isPrivileged && (
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
          )
        }
      />

      {/* Disponibilidad de ejecutivos */}
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Disponibilidad de ejecutivos</CardTitle>
              <p className="mt-0.5 text-xs text-muted">
                Vista semanal de los ejecutivos en el rango seleccionado.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 sm:grid-cols-3 lg:max-w-2xl">
            <Field label="Ejecutivo" htmlFor="ex-exec">
              <Select
                id="ex-exec"
                options={[{ value: "", label: "Todos los ejecutivos" }, ...userOptions]}
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              />
            </Field>
            <Field label="Desde" htmlFor="ex-from">
              <Input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="ex-to">
              <Input id="ex-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>

          {rangeError ? (
            <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{rangeError}</span>
            </div>
          ) : exec.loading ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : exec.error ? (
            <ErrorState error={exec.error} onRetry={exec.refetch} />
          ) : (exec.data?.executives.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Sin datos"
              description="No hay disponibilidad de ejecutivos en el rango seleccionado."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {exec.data!.executives.map((ex) => {
                const days = ex.days.filter((d) => d.available);
                return (
                  <div
                    key={ex.executiveId}
                    className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={ex.executiveName} className="h-8 w-8" />
                        <p className="truncate text-sm font-semibold text-foreground">
                          {ex.executiveName}
                        </p>
                      </div>
                      {days.length === 0 ? (
                        <Badge tone="neutral">Sin disponibilidad</Badge>
                      ) : (
                        <Badge tone="primary">
                          {days.length} {days.length === 1 ? "día" : "días"}
                        </Badge>
                      )}
                    </div>
                    {days.length === 0 ? (
                      <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted">
                        <CalendarX className="h-4 w-4 text-subtle" />
                        Sin disponibilidad en este rango.
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {days.map((d) => (
                          <li
                            key={d.date}
                            className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3"
                          >
                            <div className="flex w-32 shrink-0 items-baseline gap-1.5">
                              <span className="text-sm font-medium text-foreground">
                                {DAY_OF_WEEK_LABELS[d.dayOfWeek]?.slice(0, 3)}
                              </span>
                              <span className="text-xs text-muted">{formatDate(d.date)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {d.windows.map((w) => (
                                <span
                                  key={`${w.start}-${w.end}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground"
                                >
                                  <Clock className="h-3 w-3 text-subtle" />
                                  {w.start}–{w.end}
                                </span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestión por usuario */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1 sm:max-w-sm">
            <Field label="Usuario a gestionar" htmlFor="ag-user">
              <Select
                id="ag-user"
                options={userOptions}
                placeholder="Selecciona un usuario"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              />
            </Field>
            <p className="mt-1.5 text-xs text-muted">
              Edita su horario base, revisa su disponibilidad efectiva y gestiona sus excepciones.
            </p>
          </div>
          {(() => {
            const selectedUserName =
              userOptions.find((o) => o.value === selectedUser)?.label ?? "";
            return selectedUser && selectedUserName ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-2">
                <Avatar name={selectedUserName} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{selectedUserName}</p>
                  <p className="text-xs text-muted">Agenda en gestión</p>
                </div>
              </div>
            ) : null;
          })()}
        </CardContent>
      </Card>

      {selectedUser && (
        <>
          <ScheduleEditor userId={selectedUser} canWrite={canWrite} />

          <Card>
            <CardHeader className="flex-col items-stretch gap-1 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
                  <CalendarCheck className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Disponibilidad efectiva</CardTitle>
                  <p className="mt-0.5 text-xs text-muted">
                    Resultado del horario base con las excepciones aplicadas en una fecha.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
                <Field label="Fecha" htmlFor="av-date">
                  <Input id="av-date" type="date" value={availDate}
                    onChange={(e) => setAvailDate(e.target.value)} />
                </Field>
              </div>
              {avail.loading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : avail.error ? (
                <ErrorState error={avail.error} onRetry={avail.refetch} />
              ) : avail.data ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted/50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CalendarDays className="h-4 w-4 text-subtle" />
                      {DAY_OF_WEEK_LABELS[avail.data.dayOfWeek]} · {formatDate(avail.data.date)}
                    </div>
                    {avail.data.available ? (
                      <Badge tone="success" dot>Disponible</Badge>
                    ) : (
                      <Badge tone="neutral" dot>No disponible</Badge>
                    )}
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                        Ventanas del día
                      </p>
                      {avail.data.windows.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {avail.data.windows.map((w, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-medium tabular-nums text-primary"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {w.start}–{w.end}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">Sin ventanas disponibles ese día.</p>
                      )}
                    </div>
                    {avail.data.appliedExceptions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                          Excepciones aplicadas
                        </p>
                        <ul className="space-y-1.5">
                          {avail.data.appliedExceptions.map((ex) => (
                            <li
                              key={ex.id}
                              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs text-muted"
                            >
                              <span className="font-medium text-foreground">
                                {labelFor(EXCEPTION_TYPE_LABELS, ex.type)}
                              </span>
                              <Badge tone={ex.effect === "BLOQUEA" ? "danger" : "success"}>
                                {labelFor(EXCEPTION_EFFECT_LABELS, ex.effect)}
                              </Badge>
                              {!ex.isAllDay && ex.startTime && ex.endTime && (
                                <span className="tabular-nums">
                                  {hm(ex.startTime)}–{hm(ex.endTime)}
                                </span>
                              )}
                              {ex.reason && <span>· {ex.reason}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
                  <CalendarX className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Excepciones de disponibilidad</CardTitle>
                  <p className="mt-0.5 text-xs text-muted">
                    Vacaciones, permisos, feriados y bloqueos puntuales.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setEditingExc(null); setExcFormOpen(true); }}>
                <Plus className="h-4 w-4" />
                Nueva excepción
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-muted/60 p-3 sm:grid-cols-2 lg:max-w-md">
                <Field label="Estado" htmlFor="exc-status">
                  <Select id="exc-status" options={EXC_STATUS_FILTER}
                    value={excStatus} onChange={(e) => setExcStatus(e.target.value)} />
                </Field>
                <Field label="Tipo" htmlFor="exc-type">
                  <Select id="exc-type" options={EXC_TYPE_FILTER}
                    value={excType} onChange={(e) => setExcType(e.target.value)} />
                </Field>
              </div>
              {exc.loading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : exc.error ? (
                <ErrorState error={exc.error} onRetry={exc.refetch} />
              ) : (exc.data?.data.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<CalendarX className="h-5 w-5" />}
                  title="Sin excepciones"
                  description="No hay excepciones registradas para este usuario con los filtros actuales."
                />
              ) : (
                <ul className="space-y-2.5">
                  {exc.data!.data.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">
                            {labelFor(EXCEPTION_TYPE_LABELS, e.type)}
                          </span>
                          <Badge tone={EXCEPTION_STATUS_META[e.status]?.tone ?? "neutral"} dot>
                            {EXCEPTION_STATUS_META[e.status]?.label ?? e.status}
                          </Badge>
                          <Badge tone={e.effect === "BLOQUEA" ? "danger" : "success"}>
                            {labelFor(EXCEPTION_EFFECT_LABELS, e.effect)}
                          </Badge>
                          {e.userId === null && <Badge tone="info">Empresa</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <CalendarDays className="h-3.5 w-3.5 text-subtle" />
                            {formatDate(e.startDate)} – {formatDate(e.endDate)}
                          </span>
                          {!e.isAllDay && e.startTime && e.endTime ? (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="h-3.5 w-3.5 text-subtle" />
                              {e.startTime}–{e.endTime}
                            </span>
                          ) : (
                            <span>Todo el día</span>
                          )}
                          {e.reason && <span className="truncate">· {e.reason}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canDecide && e.status === "PENDIENTE" && (
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
                        {canWrite && e.userId !== null && (
                          <button type="button" onClick={() => { setEditingExc(e); setExcFormOpen(true); }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
                            aria-label="Editar excepción">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canWrite && e.userId !== null && (
                          <button type="button" onClick={() => setDeletingExc(e)}
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
            exception={editingExc}
            onSaved={() => exc.refetch()}
          />

          <ConfirmDialog
            open={!!deletingExc}
            onClose={() => setDeletingExc(null)}
            onConfirm={removeExc}
            title="Eliminar excepción"
            confirmLabel="Eliminar"
            loading={deleteLoading}
          />
        </>
      )}

      {isPrivileged && (
        <CsvImportDialog
          open={importOpen}
          title="Importar agendas (CSV)"
          importer={schedulesImporter}
          onClose={() => setImportOpen(false)}
          onImported={() => exec.refetch()}
        />
      )}
    </div>
  );
}
