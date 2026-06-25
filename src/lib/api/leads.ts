/**
 * Servicio del módulo Leads / CRM (ver flujos: leads/*.md).
 *
 * ⚠️ El contrato de Leads usa snake_case en request y response. El listado usa
 * además query params snake_case propios (sort_by/sort_order/page/limit y filtros
 * project_id/assigned_user_id/…), por lo que listLeads traduce el ListQuery
 * camelCase del hook compartido. Los sub-recursos vienen envueltos
 * ({ qualifications | interactions | appointments | zones | followups }) y aquí
 * se desenvuelven para devolver arrays planos.
 */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { ListQuery } from "@/lib/hooks/use-list";
import type {
  Paginated,
  Lead,
  LeadStats,
  LeadQualification,
  LeadInteraction,
  LeadAppointment,
  LeadFollowup,
  FollowupChannel,
  FollowupStatus,
  Zone,
} from "./types";

const BASE = ENDPOINTS.leads;
const enc = encodeURIComponent;

/* ---------- Lead CRUD ---------- */

export function listLeads(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<Lead>> {
  const { sortBy, sortOrder, search, page, limit, ...filters } = query;
  // filters ya trae claves snake_case (stage/status/source/intent/project_id/
  // project_unit_id/assigned_user_id/date_from/date_to/include_deleted).
  const q = {
    page,
    limit,
    ...(search ? { search } : {}),
    sort_by: sortBy ?? "created_at",
    sort_order: sortOrder,
    ...filters,
  };
  return http.get<Paginated<Lead>>(BASE, { query: q, signal });
}

export function getLead(id: string, signal?: AbortSignal): Promise<Lead> {
  return http.get<Lead>(`${BASE}/${enc(id)}`, { signal });
}

export interface CreateLeadInput {
  phone: string;
  full_name?: string;
  email?: string;
  source?: string;
  stage?: string;
  status?: string;
  assigned_user_id?: string;
  project_id?: string;
  project_unit_id?: string;
  notes?: string;
}

export function createLead(body: CreateLeadInput): Promise<Lead> {
  return http.post<Lead>(BASE, body);
}

/** PATCH parcial: enviar SOLO lo que cambió. phone NO es editable aquí. */
export interface UpdateLeadInput {
  full_name?: string;
  email?: string;
  source?: string;
  stage?: string;
  status?: string;
  intent?: string;
  brand?: string;
  score?: number;
  notes?: string;
  assigned_user_id?: string;
  project_id?: string;
  project_unit_id?: string;
  next_followup_at?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ad_id?: string;
  ad_name?: string;
  entry_point?: string;
  img?: string;
}

export function updateLead(id: string, body: UpdateLeadInput): Promise<Lead> {
  return http.patch<Lead>(`${BASE}/${enc(id)}`, body);
}

/** "Bloquear" = soft delete (ADMIN + leads:delete). Devuelve { message }. */
export function deleteLead(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(`${BASE}/${enc(id)}`);
}

/** Restaurar (ADMIN + leads:write). 409 si el lead no está eliminado. */
export function restoreLead(id: string): Promise<Lead> {
  return http.patch<Lead>(`${BASE}/${enc(id)}/restore`, {});
}

/* ---------- Asignación ---------- */

export function assignLead(id: string, assignedUserId: string): Promise<Lead> {
  return http.patch<Lead>(`${BASE}/${enc(id)}/assign`, {
    assigned_user_id: assignedUserId,
  });
}

/** Masivo: POST que responde 200 con { affected }. Recargar el listado tras éxito. */
export function bulkAssignLeads(
  leadIds: string[],
  assignedUserId: string
): Promise<{ affected: number }> {
  return http.post<{ affected: number }>(`${BASE}/bulk-assign`, {
    lead_ids: leadIds,
    assigned_user_id: assignedUserId,
  });
}

/* ---------- Estadísticas ---------- */

export interface LeadStatsQuery {
  date_from?: string;
  date_to?: string;
  assigned_user_id?: string;
}

export function leadStats(
  query: LeadStatsQuery = {},
  signal?: AbortSignal
): Promise<LeadStats> {
  return http.get<LeadStats>(`${BASE}/stats/summary`, {
    query: query as Record<string, string | undefined>,
    signal,
  });
}

/* ---------- Calificación (upsert por lead) ---------- */

export interface QualificationInput {
  project_id?: string;
  project_unit_id?: string;
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  down_payment_capacity?: number;
  monthly_payment_capacity?: number;
  financing_notes?: string;
  summary?: string;
}

export function listQualifications(
  id: string,
  signal?: AbortSignal
): Promise<LeadQualification[]> {
  return http
    .get<{ qualifications: LeadQualification[] }>(
      `${BASE}/${enc(id)}/qualifications`,
      { signal }
    )
    .then((r) => r.qualifications ?? []);
}

/** POST = upsert (crea o actualiza la calificación viva). */
export function upsertQualification(
  id: string,
  body: QualificationInput
): Promise<LeadQualification> {
  return http.post<LeadQualification>(`${BASE}/${enc(id)}/qualifications`, body);
}

export function deleteQualification(
  id: string,
  qualificationId: string
): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${BASE}/${enc(id)}/qualifications/${enc(qualificationId)}`
  );
}

/* ---------- Interacciones / notas ---------- */

export interface InteractionsQuery {
  limit?: number;
  date_from?: string;
  date_to?: string;
}

export function listInteractions(
  id: string,
  query: InteractionsQuery = {},
  signal?: AbortSignal
): Promise<LeadInteraction[]> {
  return http
    .get<{ interactions: LeadInteraction[] }>(
      `${BASE}/${enc(id)}/interactions`,
      { query: query as Record<string, string | number | undefined>, signal }
    )
    .then((r) => r.interactions ?? []);
}

export function createInteraction(
  id: string,
  body: { message_text: string; message_type?: string }
): Promise<LeadInteraction> {
  return http.post<LeadInteraction>(`${BASE}/${enc(id)}/interactions`, body);
}

/** ⚠️ La ruta OMITE el leadId: se ubica por interactionId. */
export function updateInteraction(
  interactionId: string,
  body: { message_text?: string; message_type?: string }
): Promise<LeadInteraction> {
  return http.patch<LeadInteraction>(
    `${BASE}/interactions/${enc(interactionId)}`,
    body
  );
}

/** ⚠️ La ruta OMITE el leadId. ADMIN/JEFE_COMERCIAL + leads:delete. */
export function deleteInteraction(
  interactionId: string
): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${BASE}/interactions/${enc(interactionId)}`
  );
}

/* ---------- Citas ---------- */

export interface AppointmentInput {
  type: string;
  scheduled_at: string;
  status?: string;
  assigned_user_id?: string;
  project_id?: string;
  unit_id?: string;
  location?: string;
  notes?: string;
}

export function listAppointments(
  id: string,
  signal?: AbortSignal
): Promise<LeadAppointment[]> {
  return http
    .get<{ appointments: LeadAppointment[] }>(
      `${BASE}/${enc(id)}/appointments`,
      { signal }
    )
    .then((r) => r.appointments ?? []);
}

export function createAppointment(
  id: string,
  body: AppointmentInput
): Promise<LeadAppointment> {
  return http.post<LeadAppointment>(`${BASE}/${enc(id)}/appointments`, body);
}

/** ⚠️ La ruta OMITE el leadId: se ubica por appointmentId. */
export function updateAppointment(
  appointmentId: string,
  body: Partial<AppointmentInput>
): Promise<LeadAppointment> {
  return http.patch<LeadAppointment>(
    `${BASE}/appointments/${enc(appointmentId)}`,
    body
  );
}

/** ⚠️ La ruta OMITE el leadId. ADMIN/JEFE_COMERCIAL + leads:delete. */
export function deleteAppointment(
  appointmentId: string
): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${BASE}/appointments/${enc(appointmentId)}`
  );
}

/* ---------- Zonas de interés ---------- */

export function listLeadZones(
  id: string,
  signal?: AbortSignal
): Promise<Zone[]> {
  return http
    .get<{ zones: Zone[] }>(`${BASE}/${enc(id)}/zones`, { signal })
    .then((r) => r.zones ?? []);
}

/** Reemplazo total. zone_ids no puede ir vacío. Devuelve todas las zonas. */
export function setLeadZones(id: string, zoneIds: string[]): Promise<Zone[]> {
  return http
    .put<{ zones: Zone[] }>(`${BASE}/${enc(id)}/zones`, { zone_ids: zoneIds })
    .then((r) => r.zones ?? []);
}

export function addLeadZone(id: string, zoneId: string): Promise<Zone[]> {
  return http
    .post<{ zones: Zone[] }>(`${BASE}/${enc(id)}/zones/${enc(zoneId)}`, {})
    .then((r) => r.zones ?? []);
}

export function removeLeadZone(id: string, zoneId: string): Promise<Zone[]> {
  return http
    .del<{ zones: Zone[] }>(`${BASE}/${enc(id)}/zones/${enc(zoneId)}`)
    .then((r) => r.zones ?? []);
}

/* ---------- Followups / seguimientos ---------- */

export interface FollowupsQuery {
  status?: string;
  channel?: string;
}

export interface FollowupInput {
  day_offset: number;
  scheduled_for: string;
  message_text?: string;
  channel?: FollowupChannel;
}

export function listFollowups(
  id: string,
  query: FollowupsQuery = {},
  signal?: AbortSignal
): Promise<LeadFollowup[]> {
  return http
    .get<{ followups: LeadFollowup[] }>(`${BASE}/${enc(id)}/followups`, {
      query: query as Record<string, string | undefined>,
      signal,
    })
    .then((r) => r.followups ?? []);
}

export function createFollowup(
  id: string,
  body: FollowupInput
): Promise<LeadFollowup> {
  return http.post<LeadFollowup>(`${BASE}/${enc(id)}/followups`, body);
}

/** ⚠️ La ruta OMITE el leadId. */
export function updateFollowup(
  followupId: string,
  body: {
    status?: FollowupStatus;
    message_text?: string;
    channel?: FollowupChannel;
    scheduled_for?: string;
  }
): Promise<LeadFollowup> {
  return http.patch<LeadFollowup>(`${BASE}/followups/${enc(followupId)}`, body);
}

/** Marcar enviado. 409 si el followup no está PENDIENTE. Ruta sin leadId. */
export function sendFollowup(followupId: string): Promise<LeadFollowup> {
  return http.patch<LeadFollowup>(
    `${BASE}/followups/${enc(followupId)}/send`,
    {}
  );
}

/** ⚠️ La ruta OMITE el leadId. ADMIN/JEFE_COMERCIAL + leads:delete. */
export function deleteFollowup(
  followupId: string
): Promise<{ message: string }> {
  return http.del<{ message: string }>(`${BASE}/followups/${enc(followupId)}`);
}
