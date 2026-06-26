"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  MapPin,
  User as UserIcon,
  Building2,
  CalendarX,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import { listUsers } from "@/lib/api/users";
import { listProjects } from "@/lib/api/projects";
import { listAppointmentsCalendar } from "@/lib/api/appointments";
import {
  AppointmentEditDialog,
  type EditableAppointment,
} from "@/components/appointments/appointment-edit-dialog";
import {
  APPOINTMENT_STATUS_SUGGESTIONS,
  appointmentStatusTone,
} from "@/lib/constants";
import type {
  AppointmentCalendarItem,
  Paginated,
  Project,
  User,
} from "@/lib/api/types";

/* ---------- helpers de fecha (todo en hora local del navegador) ---------- */

const DAY_MS = 86_400_000;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const timeFmt = new Intl.DateTimeFormat("es-BO", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("es-BO", {
  day: "numeric",
  month: "short",
});
const rangeFmt = new Intl.DateTimeFormat("es-BO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lunes 00:00 (local) de la semana que contiene `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0=domingo … 6=sábado
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}

function timeRange(iso: string, dur: number): string {
  const s = new Date(iso);
  const e = new Date(s.getTime() + (dur || 60) * 60_000);
  return `${timeFmt.format(s)}–${timeFmt.format(e)}`;
}

function toEditable(a: AppointmentCalendarItem): EditableAppointment {
  return {
    id: a.appointment_id,
    type: a.type,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    assigned_user_id: a.assigned_user_id,
    location: a.location,
    notes: a.notes,
    lead_name: a.lead_name,
  };
}

const STATUS_FILTER = [
  { value: "", label: "Todos los estados" },
  ...APPOINTMENT_STATUS_SUGGESTIONS.map((s) => ({ value: s, label: s })),
];

export default function CalendarioPage() {
  const { user, can } = useAuth();
  const role = user?.role;
  const canWrite =
    can("leads:write") &&
    (role === "ADMIN" ||
      role === "JEFE_COMERCIAL" ||
      role === "EJECUTIVO_VENTAS");

  // Semana visible: ancla en el lunes. Inicializamos con la semana actual.
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [executive, setExecutive] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<EditableAppointment | null>(null);

  // Opciones de filtros
  const usersFetcher = useCallback(
    (s?: AbortSignal) =>
      listUsers(
        { page: 1, limit: 100, sortBy: "firstName", sortOrder: "ASC" },
        s
      ),
    []
  );
  const { data: usersPage } = useResource<Paginated<User>>(usersFetcher, []);
  const executiveOptions = useMemo(
    () =>
      (usersPage?.data ?? []).map((u) => ({
        value: u.id,
        label: `${u.firstName} ${u.lastName}`,
      })),
    [usersPage]
  );

  const projectsFetcher = useCallback(
    (s?: AbortSignal) =>
      listProjects(
        { page: 1, limit: 100, sortBy: "name", sortOrder: "ASC" },
        s
      ),
    []
  );
  const { data: projectsPage } = useResource<Paginated<Project>>(
    projectsFetcher,
    []
  );
  const projectOptions = useMemo(
    () =>
      (projectsPage?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projectsPage]
  );

  // Los 7 días de la semana (lunes→domingo) en local.
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * DAY_MS)),
    [anchor]
  );
  const todayKey = localDateKey(new Date());

  // Rango pedido al backend con ±1 día de colchón (límite de día es UTC).
  const from = useMemo(
    () => localDateKey(new Date(anchor.getTime() - DAY_MS)),
    [anchor]
  );
  const to = useMemo(
    () => localDateKey(new Date(anchor.getTime() + 7 * DAY_MS)),
    [anchor]
  );

  const calFetcher = useCallback(
    (s?: AbortSignal) =>
      listAppointmentsCalendar(
        {
          from,
          to,
          executiveId: executive || undefined,
          projectId: project || undefined,
          status: status || undefined,
        },
        s
      ),
    [from, to, executive, project, status]
  );
  const cal = useResource(calFetcher, [from, to, executive, project, status]);

  // Agrupar por día local + ordenar por hora.
  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentCalendarItem[]>();
    for (const a of cal.data?.appointments ?? []) {
      const key = localDateKey(new Date(a.scheduled_at));
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    }
    return map;
  }, [cal.data]);

  // Citas que caen dentro de la semana visible (descarta el colchón).
  const weekKeys = useMemo(() => new Set(days.map(localDateKey)), [days]);
  const weekTotal = useMemo(
    () =>
      (cal.data?.appointments ?? []).filter((a) =>
        weekKeys.has(localDateKey(new Date(a.scheduled_at)))
      ).length,
    [cal.data, weekKeys]
  );

  const shiftWeek = (deltaWeeks: number) =>
    setAnchor((a) => new Date(a.getTime() + deltaWeeks * 7 * DAY_MS));

  const weekLabel = `${dayFmt.format(days[0])} – ${rangeFmt.format(days[6])}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de citas"
        description="Agenda de citas por ejecutivo, proyecto y estado. Las horas se muestran en tu zona local."
      />

      <Card>
        <CardContent className="space-y-5 py-5">
          {/* Barra de navegación + filtros */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border-strong bg-surface">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="grid h-10 w-10 place-items-center rounded-l-lg text-muted hover:bg-surface-muted hover:text-foreground"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="grid h-10 w-10 place-items-center rounded-r-lg border-l border-border text-muted hover:bg-surface-muted hover:text-foreground"
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAnchor(startOfWeek(new Date()))}
              >
                Hoy
              </Button>
              <div className="ml-1 min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold capitalize text-foreground">
                  <CalendarRange className="h-4 w-4 text-subtle" />
                  {weekLabel}
                </p>
                <p className="text-xs text-muted">
                  {weekTotal} {weekTotal === 1 ? "cita" : "citas"} esta semana
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:max-w-2xl">
              <Field label="Ejecutivo" htmlFor="cal-exec">
                <Select
                  id="cal-exec"
                  options={[
                    { value: "", label: "Todos" },
                    ...executiveOptions,
                  ]}
                  value={executive}
                  onChange={(e) => setExecutive(e.target.value)}
                />
              </Field>
              <Field label="Proyecto" htmlFor="cal-proj">
                <Select
                  id="cal-proj"
                  options={[{ value: "", label: "Todos" }, ...projectOptions]}
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                />
              </Field>
              <Field label="Estado" htmlFor="cal-status">
                <Select
                  id="cal-status"
                  options={STATUS_FILTER}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Cuadrícula semanal */}
          {cal.error ? (
            <ErrorState error={cal.error} onRetry={cal.refetch} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {days.map((d) => {
                const key = localDateKey(d);
                const items = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={
                      "flex min-h-32 flex-col rounded-xl border bg-surface " +
                      (isToday
                        ? "border-primary/40 ring-1 ring-primary/20"
                        : "border-border")
                    }
                  >
                    <div
                      className={
                        "flex items-baseline justify-between gap-1 rounded-t-xl border-b px-3 py-2 " +
                        (isToday
                          ? "border-primary/30 bg-primary-soft"
                          : "border-border bg-surface-muted/50")
                      }
                    >
                      <span
                        className={
                          "text-xs font-semibold uppercase tracking-wide " +
                          (isToday ? "text-primary" : "text-subtle")
                        }
                      >
                        {DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                      </span>
                      <span
                        className={
                          "text-sm font-semibold tabular-nums " +
                          (isToday ? "text-primary" : "text-foreground")
                        }
                      >
                        {dayFmt.format(d)}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2 p-2">
                      {cal.loading ? (
                        <Skeleton className="h-16 w-full rounded-lg" />
                      ) : items.length === 0 ? (
                        <div className="flex h-full min-h-20 flex-col items-center justify-center gap-1 text-subtle">
                          <CalendarX className="h-4 w-4" />
                          <span className="text-[11px]">Sin citas</span>
                        </div>
                      ) : (
                        items.map((a) => {
                          const muted =
                            a.status === "CANCELADA" ||
                            a.status === "REAGENDADA";
                          return (
                            <button
                              key={a.appointment_id}
                              type="button"
                              onClick={
                                canWrite
                                  ? () => setEditing(toEditable(a))
                                  : undefined
                              }
                              disabled={!canWrite}
                              className={
                                "w-full rounded-lg border p-2 text-left transition-colors " +
                                (muted
                                  ? "border-border bg-surface-muted/40 opacity-70 "
                                  : "border-border bg-surface ") +
                                (canWrite
                                  ? "hover:border-primary/40 hover:bg-primary-soft/40 "
                                  : "cursor-default ")
                              }
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold tabular-nums text-foreground">
                                  {timeRange(a.scheduled_at, a.duration_minutes)}
                                </span>
                                <Badge
                                  tone={appointmentStatusTone(a.status)}
                                  className="px-1.5 py-0 text-[10px]"
                                >
                                  {a.status}
                                </Badge>
                              </div>
                              <p
                                className={
                                  "mt-1 truncate text-xs font-medium " +
                                  (muted
                                    ? "text-muted line-through"
                                    : "text-foreground")
                                }
                              >
                                {a.lead_name ?? "Lead sin nombre"}
                              </p>
                              <p className="truncate text-[11px] text-muted">
                                {a.type}
                              </p>
                              {a.executive_name && !executive && (
                                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-subtle">
                                  <UserIcon className="h-3 w-3 shrink-0" />
                                  {a.executive_name}
                                </p>
                              )}
                              {a.project_name && (
                                <p className="flex items-center gap-1 truncate text-[11px] text-subtle">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {a.project_name}
                                  {a.unit_code ? ` · ${a.unit_code}` : ""}
                                </p>
                              )}
                              {a.location && (
                                <p className="flex items-center gap-1 truncate text-[11px] text-subtle">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {a.location}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentEditDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        appointment={editing}
        executiveOptions={executiveOptions}
        onSaved={() => cal.refetch()}
      />
    </div>
  );
}
