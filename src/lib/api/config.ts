/**
 * Configuración base de la API del panel.
 * El host se define por entorno (NEXT_PUBLIC_API_BASE_URL).
 * Local (QA): http://localhost:3002 — Prod: dominio de Railway.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

/** Prefijo de todos los endpoints excepto /health. */
export const API_PREFIX = "/api/v1";

export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;

/** Rutas del contrato, centralizadas para reutilizar en los servicios. */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    me: "/auth/me",
  },
  users: "/users",
  roles: "/roles",
  permissions: "/permissions",
  projects: "/projects",
  units: "/units",
  sales: "/sales",
  financingPlans: "/financing-plans",
  schedules: "/schedules",
  knowledgeBase: "/knowledge-base",
  kbCategories: "/kb-categories",
  kbTags: "/kb-tags",
  apiClients: "/api-clients",
  apiScopes: "/api-scopes",
  activityLog: "/activity-log",
  notifications: "/notifications",
  uploads: "/uploads",
} as const;
