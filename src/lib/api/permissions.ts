/** Servicio del módulo Permisos (RBAC). Listado sin paginación (array plano, orden por code). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Permission } from "./types";

export interface CreatePermissionInput {
  code: string; // resource:action (minúsculas)
  name: string;
  description?: string;
}

export interface UpdatePermissionInput {
  name?: string;
  description?: string;
}

export const PERMISSION_CODE_RE = /^[a-z0-9-]+:[a-z0-9-]+$/;

const byId = (id: string) => `${ENDPOINTS.permissions}/${encodeURIComponent(id)}`;

export function listPermissions(signal?: AbortSignal): Promise<Permission[]> {
  return http.get<Permission[]>(ENDPOINTS.permissions, { signal });
}

export function createPermission(
  body: CreatePermissionInput
): Promise<Permission> {
  return http.post<Permission>(ENDPOINTS.permissions, body);
}

export function updatePermission(
  id: string,
  body: UpdatePermissionInput
): Promise<Permission> {
  return http.patch<Permission>(byId(id), body);
}

export function deletePermission(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(byId(id));
}
