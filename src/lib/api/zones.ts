/**
 * Catálogo de zonas (recurso aparte: GET /zones). Lo usa el módulo Leads para
 * el selector de "zonas de interés".
 *
 * ⚠️ El envelope exacto de /zones no está documentado en un flujo propio (solo
 * referenciado desde leads/11). Se normaliza para aceptar tanto un array crudo
 * como { data } paginado. Confirmar contrato con backend (ver reporte).
 */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, Zone } from "./types";

export function listZones(signal?: AbortSignal): Promise<Zone[]> {
  return http
    .get<Zone[] | Paginated<Zone>>(ENDPOINTS.zones, {
      query: { limit: 200 },
      signal,
    })
    .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])));
}
