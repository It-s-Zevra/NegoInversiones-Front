/**
 * Matriz rol → permisos (estado inicial del seed del backend, ver flujos §4).
 *
 * ⚠️ Esto es SOLO una pista de UI para ocultar/deshabilitar acciones.
 * La autorización real la hace el backend en cada endpoint: confiar siempre en
 * el 403. La asignación rol→permiso es editable en caliente, así que esta tabla
 * puede quedar desactualizada respecto al backend.
 *
 * Por qué un seed estático y no permisos en vivo: `GET /auth/me` (MeResponseDto)
 * NO devuelve los permisos finos, `GET /roles` (listado) tampoco los incluye, y
 * `GET /roles/:id` (que sí los trae) es ADMIN-only. Es decir, un usuario no-ADMIN
 * no tiene forma de descubrir sus permisos efectivos desde el cliente. Por eso la
 * recomendación del contrato (_comunes/04 §6) es: usar el `role` para la UI de alto
 * nivel y reaccionar al 403 del backend como autoridad final (ver ErrorState → 403).
 *
 * `leads:*`: confirmado con backend que son permisos del panel (tabla
 * `permissions`, vía @RequirePermissions), no api_scopes. `leads:delete` lo tienen
 * ADMIN y JEFE_COMERCIAL; aun así el endpoint DELETE /leads/:id (bloquear) exige
 * además @Roles(ADMIN), por lo que la UI gatea ese borrado solo a ADMIN.
 */
import type { UserRole } from "@/lib/api/types";

const ALL = "*";

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: [ALL],
  DIRECTOR_GENERAL: [
    "projects:read",
    "sales:read",
    "leads:read",
    "financing-plans:read",
    "kb:read",
  ],
  JEFE_COMERCIAL: [
    "projects:read",
    "projects:write",
    "projects:delete",
    "sales:read",
    "sales:write",
    "leads:read",
    "leads:write",
    "leads:delete",
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
    "leads:read",
    "leads:write",
    "financing-plans:read",
    "kb:read",
  ],
  CARTERA: [
    "projects:read",
    "sales:read",
    "leads:read",
    "financing-plans:read",
    "kb:read",
  ],
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
    "leads:read",
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
