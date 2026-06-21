/** Servicio de Clientes de API y Scopes. Listados sin paginación (arrays planos). */
import { http } from "./http";
import { ENDPOINTS } from "./config";
import type {
  ApiClient,
  ApiClientCreated,
  ApiClientDetail,
  ApiScope,
} from "./types";

export const SCOPE_CODE_RE = /^[a-z0-9-]+:[a-z0-9-]+$/;

const clientById = (id: string) =>
  `${ENDPOINTS.apiClients}/${encodeURIComponent(id)}`;

export function listApiClients(signal?: AbortSignal): Promise<ApiClient[]> {
  return http.get<ApiClient[]>(ENDPOINTS.apiClients, { signal });
}

export function createApiClient(body: {
  name: string;
  scopeIds?: string[];
}): Promise<ApiClientCreated> {
  return http.post<ApiClientCreated>(ENDPOINTS.apiClients, body);
}

export function updateApiClient(
  id: string,
  body: { name?: string; isActive?: boolean }
): Promise<ApiClient> {
  return http.patch<ApiClient>(clientById(id), body);
}

export function revokeApiClient(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(clientById(id));
}

/** Reemplazo total de scopes del cliente. */
export function setApiClientScopes(
  id: string,
  scopeIds: string[]
): Promise<ApiClientDetail> {
  return http.put<ApiClientDetail>(`${clientById(id)}/scopes`, { scopeIds });
}

export function listApiScopes(signal?: AbortSignal): Promise<ApiScope[]> {
  return http.get<ApiScope[]>(ENDPOINTS.apiScopes, { signal });
}

export function createApiScope(body: {
  code: string;
  description?: string;
}): Promise<ApiScope> {
  return http.post<ApiScope>(ENDPOINTS.apiScopes, body);
}
