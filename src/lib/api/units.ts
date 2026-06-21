/** Servicio del módulo Unidades (ver flujos: unidades/*.md + proyectos/07,08). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  Paginated,
  Unit,
  UnitType,
  UnitStatus,
  UnitAction,
} from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export type { UnitAction };

export interface CreateUnitInput {
  code: string;
  type: UnitType;
  status?: UnitStatus;
  areaM2?: number;
  price?: number;
  currency?: string;
  bedrooms?: number;
  bathrooms?: number;
  builtAreaM2?: number;
  frontageM?: number;
  depthM?: number;
  hasUtilities?: boolean;
  imgUrl?: string[];
  location?: string;
  address1?: string;
  address2?: string;
  references?: string;
  financingPlanId?: string;
}

export type UpdateUnitInput = Partial<CreateUnitInput>;

/** sortBy permitidos por el backend para el listado de unidades. */
export const UNIT_SORT_FIELDS = [
  "code",
  "price",
  "areaM2",
  "status",
  "createdAt",
] as const;

/** Listado de unidades de un proyecto: GET /projects/:id/units. */
export function listProjectUnits(
  projectId: string,
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<Unit>> {
  // Clamp del sortBy al allowlist (evita 400 si una columna usa un sortKey no permitido).
  const sortBy = (UNIT_SORT_FIELDS as readonly string[]).includes(
    query.sortBy ?? ""
  )
    ? query.sortBy
    : "createdAt";
  return http.get<Paginated<Unit>>(
    `${ENDPOINTS.projects}/${encodeURIComponent(projectId)}/units`,
    { query: { ...query, sortBy }, signal }
  );
}

export function getUnit(id: string, signal?: AbortSignal): Promise<Unit> {
  return http.get<Unit>(`${ENDPOINTS.units}/${encodeURIComponent(id)}`, {
    signal,
  });
}

/** Alta de unidad dentro de un proyecto: POST /projects/:id/units. */
export function createProjectUnit(
  projectId: string,
  body: CreateUnitInput
): Promise<Unit> {
  return http.post<Unit>(
    `${ENDPOINTS.projects}/${encodeURIComponent(projectId)}/units`,
    body
  );
}

export function updateUnit(id: string, body: UpdateUnitInput): Promise<Unit> {
  return http.patch<Unit>(
    `${ENDPOINTS.units}/${encodeURIComponent(id)}`,
    body
  );
}

export function deleteUnit(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.units}/${encodeURIComponent(id)}`
  );
}

/** Transición de estado (reserve/sell/block/release) — POST sin body. */
export function changeUnitStatus(
  id: string,
  action: UnitAction
): Promise<Unit> {
  return http.post<Unit>(
    `${ENDPOINTS.units}/${encodeURIComponent(id)}/${encodeURIComponent(action)}`
  );
}
