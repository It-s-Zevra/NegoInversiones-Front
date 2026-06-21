/** Servicio del módulo Roles (RBAC). Listado sin paginación (array plano). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type { Role, RoleDetail, UserRole } from "./types";

export interface CreateRoleInput {
  code: UserRole;
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

const byId = (id: string) => `${ENDPOINTS.roles}/${encodeURIComponent(id)}`;

export function listRoles(signal?: AbortSignal): Promise<Role[]> {
  return http.get<Role[]>(ENDPOINTS.roles, { signal });
}

export function getRole(id: string, signal?: AbortSignal): Promise<RoleDetail> {
  return http.get<RoleDetail>(byId(id), { signal });
}

export function createRole(body: CreateRoleInput): Promise<Role> {
  return http.post<Role>(ENDPOINTS.roles, body);
}

export function updateRole(id: string, body: UpdateRoleInput): Promise<Role> {
  return http.patch<Role>(byId(id), body);
}

export function deleteRole(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(byId(id));
}

/** Reemplazo total de permisos del rol. */
export function setRolePermissions(
  id: string,
  permissionIds: string[]
): Promise<RoleDetail> {
  return http.put<RoleDetail>(`${byId(id)}/permissions`, { permissionIds });
}
