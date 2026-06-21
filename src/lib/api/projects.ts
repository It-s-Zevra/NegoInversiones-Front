/** Servicio del módulo Proyectos (ver flujos: proyectos/*.md). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Paginated, Project, Brand, UnitType } from "./types";
import type { ListQuery } from "@/lib/hooks/use-list";

export interface CreateProjectInput {
  name: string;
  brand: Brand;
  type: UnitType;
  location?: string;
  city?: string;
  description?: string;
  totalUnits?: number;
  imgUrl?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  isActive?: boolean;
};

/** sortBy permitidos por el backend (allowlist). */
export const PROJECT_SORT_FIELDS = [
  "name",
  "city",
  "totalUnits",
  "createdAt",
  "updatedAt",
] as const;

export function listProjects(
  query: ListQuery,
  signal?: AbortSignal
): Promise<Paginated<Project>> {
  // Clamp del sortBy al allowlist (evita 400 si una columna usa un sortKey no permitido).
  const sortBy = (PROJECT_SORT_FIELDS as readonly string[]).includes(
    query.sortBy ?? ""
  )
    ? query.sortBy
    : "createdAt";
  return http.get<Paginated<Project>>(ENDPOINTS.projects, {
    query: { ...query, sortBy },
    signal,
  });
}

export function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  return http.get<Project>(`${ENDPOINTS.projects}/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function createProject(body: CreateProjectInput): Promise<Project> {
  return http.post<Project>(ENDPOINTS.projects, body);
}

export function updateProject(
  id: string,
  body: UpdateProjectInput
): Promise<Project> {
  return http.patch<Project>(
    `${ENDPOINTS.projects}/${encodeURIComponent(id)}`,
    body
  );
}

export function deleteProject(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(
    `${ENDPOINTS.projects}/${encodeURIComponent(id)}`
  );
}
