/** Servicio del módulo Agendas / Disponibilidad. */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  Paginated,
  Schedule,
  AvailabilityException,
  AvailabilityResolution,
  ExecutivesAvailability,
  AvailabilityExceptionType,
  AvailabilityExceptionEffect,
} from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const EXCEPTION_SORT_FIELDS = [
  "startDate",
  "endDate",
  "createdAt",
  "type",
  "status",
] as const;

export interface ScheduleWindowInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

/** Disponibilidad semanal de un usuario (GET/PUT). PUT reemplaza todo. */
export function getUserSchedule(
  userId: string,
  signal?: AbortSignal
): Promise<Schedule[]> {
  return http.get<Schedule[]>(
    `${ENDPOINTS.users}/${encodeURIComponent(userId)}/schedule`,
    { signal }
  );
}

export function setUserSchedule(
  userId: string,
  entries: ScheduleWindowInput[]
): Promise<Schedule[]> {
  return http.put<Schedule[]>(
    `${ENDPOINTS.users}/${encodeURIComponent(userId)}/schedule`,
    { entries }
  );
}

export function deleteSchedule(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.schedules}/${encodeURIComponent(id)}`
  );
}

/* Excepciones de disponibilidad */
export interface CreateExceptionInput {
  type: AvailabilityExceptionType;
  effect?: AvailabilityExceptionEffect;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  notes?: string;
}
export type UpdateExceptionInput = Partial<CreateExceptionInput>;

export function listUserExceptions(
  userId: string,
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<AvailabilityException>> {
  return http.get<Paginated<AvailabilityException>>(
    `${ENDPOINTS.users}/${encodeURIComponent(userId)}/availability-exceptions`,
    { query, signal }
  );
}

export function createUserException(
  userId: string,
  body: CreateExceptionInput
): Promise<AvailabilityException> {
  return http.post<AvailabilityException>(
    `${ENDPOINTS.users}/${encodeURIComponent(userId)}/availability-exceptions`,
    body
  );
}

const exceptionById = (id: string) =>
  `/availability-exceptions/${encodeURIComponent(id)}`;

export function updateException(
  id: string,
  body: UpdateExceptionInput
): Promise<AvailabilityException> {
  return http.patch<AvailabilityException>(exceptionById(id), body);
}

export function deleteException(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(exceptionById(id));
}

export function approveException(id: string): Promise<AvailabilityException> {
  return http.post<AvailabilityException>(`${exceptionById(id)}/approve`);
}

export function rejectException(id: string): Promise<AvailabilityException> {
  return http.post<AvailabilityException>(`${exceptionById(id)}/reject`);
}

/** Disponibilidad efectiva de un usuario en una fecha concreta (ver flujos/agendas/12).
   = horario recurrente − excepciones APROBADAS que bloquean + las que abren. */
export function userAvailability(
  userId: string,
  date: string,
  signal?: AbortSignal
): Promise<AvailabilityResolution> {
  return http.get<AvailabilityResolution>(
    `${ENDPOINTS.users}/${encodeURIComponent(userId)}/availability`,
    { query: { date }, signal }
  );
}

/** Disponibilidad de ejecutivos en un rango (vista de gestión). */
export function executivesAvailability(
  query: { from: string; to: string; executiveId?: string },
  signal?: AbortSignal
): Promise<ExecutivesAvailability> {
  return http.get<ExecutivesAvailability>("/availability/executives", {
    query,
    signal,
  });
}
