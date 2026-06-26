"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  User as UserIcon,
  Building2,
  Clock,
  CalendarCheck2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
const dayNumFmt = new Intl.DateTimeFormat("es-BO", { day: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat("es-BO", { month: "short" });

/** Etiqueta compacta del rango semanal: "22 – 28 jun 2026" / "29 jun – 5 jul 2026". */
function weekRangeLabel(a: Date, b: Date): string {
  const year = b.getFullYear();
  const ma = monthShortFmt.format(a).replace(".", "");
  const mb = monthShortFmt.format(b).replace(".", "");
  const da = dayNumFmt.format(a);
  const db = dayNumFmt.format(b);
  return a.getMonth() === b.getMonth()
    ? `${da} – ${db} ${mb} ${year}`
    : `${da} ${ma} – ${db} ${mb} ${year}`;
}

/** Acento (borde izquierdo) y punto de color por estado de la cita. */
const STATUS_ACCENT: Record<string, string> = {
  AGENDADA: "border-l-info",
  CONFIRMADA: "border-l-primary",
  REALIZADA: "border-l-success",
  CANCELADA: "border-l-danger",
  REAGENDADA: "border-l-warning",
};
const STATUS_DOT: Record<string, string> = {
  AGENDADA: "bg-info",
  CONFIRMADA: "bg-primary",
  REALIZADA: "bg-success",
  CANCELADA: "bg-danger",
  REAGENDADA: "bg-warning",
};

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

  const weekLabel = weekRangeLabel(days[0], days[6]);
  const isCurrentWeek = weekKeys.has(todayKey);
  const activeFilters = [executive, project, status].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de citas"
        description="Agenda de citas por ejecutivo, proyecto y estado. Las horas se muestran en tu zona local."
      />

      <Card>
        <CardContent className="space-y-4 py-5">
          {/* Barra de navegación */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-border-strong bg-surface shadow-soft">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  className="grid h-9 w-9 place-items-center rounded-l-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                  aria-label="Semana anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnchor(startOfWeek(new Date()))}
                  className="h-9 border-x border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  className="grid h-9 w-9 place-items-center rounded-r-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                  aria-label="Semana siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold tracking-tight text-foreground">
                  {weekLabel}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-subtle" />
                  {weekTotal} {weekTotal === 1 ? "cita" : "citas"} ·{" "}
                  {isCurrentWeek ? "esta semana" : "semana seleccionada"}
                </p>
              </div>
            </div>

            {/* Leyenda de estados */}
            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex">
              {APPOINTMENT_STATUS_SUGGESTIONS.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted"
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full " + (STATUS_DOT[s] ?? "bg-subtle")
                    }
                  />
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-3">
            <Field label="Ejecutivo" htmlFor="cal-exec">
              <Select
                id="cal-exec"
                options={[{ value: "", label: "Todos" }, ...executiveOptions]}
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
            {activeFilters > 0 && (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setExecutive("");
                    setProject("");
                    setStatus("");
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpiar filtros ({activeFilters})
                </button>
              </div>
            )}
          </div>

          {/* Cuadrícula semanal */}
          {cal.error ? (
            <ErrorState error={cal.error} onRetry={cal.refetch} />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
              {days.map((d, idx) => {
                const key = localDateKey(d);
                const items = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isWeekend = idx >= 5;
                return (
                  <div
                    key={key}
                    className={
                      "flex min-h-36 flex-col overflow-hidden rounded-xl border transition-shadow " +
                      (isToday
                        ? "border-primary/40 shadow-soft ring-1 ring-primary/20"
                        : "border-border") +
                      (isWeekend && !isToday ? " bg-surface-muted/30" : " bg-surface")
                    }
                  >
                    <div
                      className={
                        "flex items-center justify-between gap-1 border-b px-3 py-2 " +
                        (isToday
                          ? "border-primary/20 bg-primary-soft"
                          : "border-border bg-surface-muted/40")
                      }
                    >
                      <span
                        className={
                          "text-[11px] font-semibold uppercase tracking-wide " +
                          (isToday
                            ? "text-primary"
                            : isWeekend
                              ? "text-subtle/80"
                              : "text-subtle")
                        }
                      >
                        {DAY_NAMES[idx]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {items.length > 0 && (
                          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-foreground/10 px-1 text-[10px] font-semibold tabular-nums text-foreground">
                            {items.length}
                          </span>
                        )}
                        <span
                          className={
                            "grid h-6 min-w-6 place-items-center rounded-full px-1 text-sm font-bold tabular-nums " +
                            (isToday
                              ? "bg-primary text-white"
                              : "text-foreground")
                          }
                        >
                          {dayNumFmt.format(d)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2 p-2">
                      {cal.loading ? (
                        <>
                          <Skeleton className="h-16 w-full rounded-lg" />
                          {idx % 2 === 0 && (
                            <Skeleton className="h-16 w-full rounded-lg" />
                          )}
                        </>
                      ) : items.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center py-4">
                          <span className="text-[11px] text-subtle/70">—</span>
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
                              title={canWrite ? "Editar cita" : undefined}
                              className={
                                "group w-full rounded-lg border border-l-[3px] bg-surface p-2 text-left shadow-soft transition-all " +
                                (STATUS_ACCENT[a.status] ?? "border-l-subtle") +
                                " border-y-border border-r-border " +
                                (muted ? "opacity-60 " : "") +
                                (canWrite
                                  ? "hover:-translate-y-0.5 hover:border-y-primary/30 hover:border-r-primary/30 hover:shadow-pop "
                                  : "cursor-default ")
                              }
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-foreground">
                                  <Clock className="h-3 w-3 text-subtle" />
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
                                  "mt-1.5 truncate text-[13px] font-semibold " +
                                  (muted
                                    ? "text-muted line-through"
                                    : "text-foreground")
                                }
                              >
                                {a.lead_name ?? "Lead sin nombre"}
                              </p>
                              <p className="truncate text-[11px] font-medium text-muted">
                                {a.type}
                              </p>
                              <div className="mt-1 space-y-0.5">
                                {a.executive_name && !executive && (
                                  <p className="flex items-center gap-1 truncate text-[11px] text-subtle">
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
                              </div>
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
