/**
 * Matriz rol → permisos (estado inicial del seed del backend, ver flujos §4).
 *
 * ⚠️ Esto es SOLO una pista de UI para ocultar/deshabilitar acciones.
 * La autorización real la hace el backend en cada endpoint: confiar siempre en
 * el 403. La asignación rol→permiso es editable en caliente, así que esta tabla
 * puede quedar desactualizada respecto al backend.
 */
import type { UserRole } from "@/lib/api/types";

const ALL = "*";

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [ALL],
  DIRECTOR_GENERAL: [
    "projects:read",
    "sales:read",
    "financing-plans:read",
    "kb:read",
  ],
  JEFE_COMERCIAL: [
    "projects:read",
    "projects:write",
    "projects:delete",
    "sales:read",
    "sales:write",
    "schedules:read",
    "schedules:write",
    "schedules:delete",
    "financing-plans:read",
    "financing-plans:write",
    "financing-options:write",
    "kb:read",
    "kb:write",
    "kb:delete",
  ],
  EJECUTIVO_VENTAS: [
    "projects:read",
    "sales:read",
    "sales:write",
    "financing-plans:read",
    "kb:read",
  ],
  CARTERA: ["projects:read", "sales:read", "financing-plans:read", "kb:read"],
  LEGAL: ["projects:read", "sales:read", "financing-plans:read", "kb:read"],
  FINANZAS: [
    "projects:read",
    "sales:read",
    "financing-plans:read",
    "financing-plans:write",
    "financing-options:write",
    "kb:read",
  ],
  PROYECTOS: [
    "projects:read",
    "projects:write",
    "projects:delete",
    "sales:read",
    "financing-plans:read",
    "kb:read",
  ],
};

/** ¿El rol tiene (probablemente) este permiso? Pista de UI, no autoridad. */
export function roleCan(
  role: UserRole | null | undefined,
  permission: string
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(ALL) || perms.includes(permission);
}
