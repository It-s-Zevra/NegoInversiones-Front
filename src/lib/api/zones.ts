/**
 * Catálogo de zonas (GET /zones). Lo usa el módulo Leads para el selector de
 * "zonas de interés".
 *
 * Contrato confirmado con backend: requiere JWT + leads:read (no público) y
 * devuelve un ARRAY CRUDO (sin envelope ni paginación) de { id, name, city,
 * created_at, updated_at }. Hay CRUD (POST/PATCH ADMIN+JEFE_COMERCIAL, DELETE
 * ADMIN) que el panel no consume todavía.
 */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Zone } from "./types";

export function listZones(signal?: AbortSignal): Promise<Zone[]> {
  return http.get<Zone[]>(ENDPOINTS.zones, { signal });
}
