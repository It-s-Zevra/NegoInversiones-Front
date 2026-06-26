/**
 * Servicio del calendario global de citas (panel, JWT `leads:read`).
 *
 *   GET /api/v1/appointments → citas de un rango, enriquecidas con los nombres
 *   de lead / ejecutivo / proyecto / unidad. Sirve para la vista de agenda y
 *   para pre-validar solapes del lado del cliente antes de crear/editar.
 *
 * La validación de solape también vive en el backend (422), por lo que el chequeo
 * de aquí es solo UX: avisa al usuario antes de enviar; el 422 queda como red de
 * seguridad. Las citas CANCELADA/REAGENDADA no cuentan como ocupación.
 */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  AppointmentCalendarItem,
  AppointmentCalendarResponse,
} from "./types";

const BASE = ENDPOINTS.appointments;

/** Estados que NO ocupan agenda (no generan solape). */
const INACTIVE_STATUSES = new Set(["CANCELADA", "REAGENDADA"]);

export interface CalendarQuery {
  /** YYYY-MM-DD inclusive (obligatorio). */
  from: string;
  /** YYYY-MM-DD inclusive (obligatorio, máx. 92 días desde `from`). */
  to: string;
  executiveId?: string;
  projectId?: string;
  status?: string;
}

/** Lista las citas del rango para el calendario. Orden: scheduled_at ASC. */
export function listAppointmentsCalendar(
  query: CalendarQuery,
  signal?: AbortSignal
): Promise<AppointmentCalendarResponse> {
  return http.get<AppointmentCalendarResponse>(BASE, {
    query: {
      from: query.from,
      to: query.to,
      executiveId: query.executiveId,
      projectId: query.projectId,
      status: query.status,
    },
    signal,
  });
}

/** YYYY-MM-DD en hora local (no UTC) a partir de un Date. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Busca citas activas del ejecutivo que se solapen con el intervalo propuesto.
 * Regla de solape (tiempo absoluto): inicioExistente < finNuevo && finExistente > inicioNuevo.
 * Devuelve [] si faltan datos. Pide un día de colchón a cada lado y filtra por
 * tiempo absoluto, así que es robusto frente al límite de día UTC del backend.
 */
export async function findExecutiveOverlaps(params: {
  executiveId: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  excludeId?: string;
  signal?: AbortSignal;
}): Promise<AppointmentCalendarItem[]> {
  const { executiveId, scheduledAt, durationMinutes, excludeId, signal } =
    params;
  if (!executiveId || !scheduledAt) return [];

  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return [];
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  // Rango con colchón de ±1 día (cubre citas cercanas a medianoche UTC).
  const from = localDateKey(new Date(start.getTime() - 86_400_000));
  const to = localDateKey(new Date(end.getTime() + 86_400_000));

  const res = await listAppointmentsCalendar(
    { from, to, executiveId },
    signal
  );

  return res.appointments.filter((a) => {
    if (a.appointment_id === excludeId) return false;
    if (INACTIVE_STATUSES.has(a.status)) return false;
    const aStart = new Date(a.scheduled_at).getTime();
    const aEnd = aStart + (a.duration_minutes || 60) * 60_000;
    return aStart < end.getTime() && aEnd > start.getTime();
  });
}

/** ¿El error del backend es un 422 por solape de citas? (mensaje en inglés). */
export function isOverlapError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    (err as { statusCode: number }).statusCode === 422 &&
    "messages" in err &&
    Array.isArray((err as { messages: unknown }).messages) &&
    (err as { messages: string[] }).messages.some((m) =>
      m.toLowerCase().includes("already has an appointment")
    )
  );
}
