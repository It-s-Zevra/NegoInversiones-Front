/**
 * Cliente HTTP del panel.
 *  - Inyecta `Authorization: Bearer <accessToken>` (access en memoria).
 *  - Normaliza el error global del backend ({statusCode,error,message,timestamp}).
 *  - Auto-refresh ante 401 vía el BFF (/api/auth/refresh, cookie HttpOnly), con
 *    single-flight por pestaña + Web Locks para serializar entre pestañas
 *    (evita que la rotación del refresh dispare la revocación de toda la familia).
 *  - Distingue 401 renovable (refresh) de no renovable ("Invalid token",
 *    "User not found") y de fallos transitorios (5xx/429/red), que NO cierran sesión.
 */
import { apiUrl } from "./config";
import type { ApiError } from "./types";
import {
  getAccessToken,
  setAccessToken,
  clearSession,
  hasSessionHint,
} from "@/lib/auth/storage";

/** URL del refresh en el BFF (mismo origen, cookie HttpOnly). */
const BFF_REFRESH_URL = "/api/auth/refresh";

/** 401 que un refresh NO puede arreglar (ver flujos auth/01 §6.4 / §10). */
const NON_RENEWABLE_401 = new Set(["Invalid token", "User not found"]);

/** Error tipado de la API; `messages` siempre es un array (backend usa string|string[]). */
export class ApiException extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly messages: string[];
  readonly raw: ApiError | null;

  constructor(payload: ApiError | null, fallbackStatus: number) {
    const messages = payload
      ? Array.isArray(payload.message)
        ? payload.message
        : [payload.message]
      : ["No se pudo conectar con el servidor"];
    super(messages[0] ?? "Error");
    this.name = "ApiException";
    this.statusCode = payload?.statusCode ?? fallbackStatus;
    this.error = payload?.error ?? "Error";
    this.messages = messages;
    this.raw = payload;
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}

/** Handler global para sesión irrecuperable (lo registra el AuthProvider). */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/** Refresh único en vuelo por pestaña (single-flight). */
let refreshPromise: Promise<string | null> | null = null;

function ensureRefreshed(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Serializa el refresh entre pestañas del mismo origen (Web Locks). */
function withRefreshLock(): Promise<string | null> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // El runtime aplana el promise devuelto por el callback; el tipo del lib DOM
    // lo modela como anidado, así que normalizamos con un cast.
    return navigator.locks.request("ni_refresh", () =>
      performRefresh()
    ) as unknown as Promise<string | null>;
  }
  return performRefresh();
}

/**
 * Resultado:
 *  - string  → nuevo access token.
 *  - null    → sesión muerta (401): el BFF ya limpió la cookie HttpOnly.
 *  - throw   → fallo transitorio (5xx/429/red): NO cerrar sesión, reintentar luego.
 */
async function performRefresh(): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(BFF_REFRESH_URL, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    throw new ApiException(null, 0); // red: transitorio
  }

  if (res.ok) {
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return data.accessToken;
  }

  if (res.status === 401) {
    clearSession(); // sesión irrecuperable
    return null;
  }

  // 5xx / 429: transitorio
  const payload = parseErrorBody(await res.text());
  throw new ApiException(payload, res.status);
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Adjuntar Bearer (default: true). */
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function parseErrorBody(text: string): ApiError | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiError;
  } catch {
    return null;
  }
}

function firstMessage(payload: ApiError | null): string {
  if (!payload) return "";
  return Array.isArray(payload.message)
    ? payload.message[0] ?? ""
    : payload.message;
}

async function doFetch(
  path: string,
  { method = "GET", body, auth = true, query, signal }: RequestOptions
): Promise<Response> {
  // FormData (multipart): el navegador fija el Content-Type con su boundary;
  // no serializar a JSON ni forzar la cabecera (subidas de CSV/archivos).
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    return await fetch(apiUrl(path) + buildQuery(query), {
      method,
      headers,
      body:
        body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
      credentials: "omit",
    });
  } catch {
    throw new ApiException(null, 0); // error de red
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const payload = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiException((payload as ApiError) ?? null, res.status);
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true } = options;

  // Sin access token pero con sesión probable (p. ej. tras recargar): refrescar antes.
  if (auth && !getAccessToken() && hasSessionHint()) {
    try {
      await ensureRefreshed();
    } catch {
      // transitorio: seguimos; el 401 posterior lo gestiona el bloque de abajo
    }
  }

  const res = await doFetch(path, options);

  if (res.status === 401 && auth) {
    const payload = parseErrorBody(await res.text());

    // 401 que el refresh no arregla → directo a login.
    if (NON_RENEWABLE_401.has(firstMessage(payload))) {
      onUnauthorized?.();
      throw new ApiException(payload, 401);
    }

    // Refresh (single-flight + lock). Si lanza, es transitorio → propaga sin cerrar sesión.
    const newToken = await ensureRefreshed();
    if (newToken) {
      const retry = await doFetch(path, options); // reintento único
      if (retry.status !== 401) return parse<T>(retry);
      // El token recién emitido también fue rechazado: sesión irrecuperable.
    }

    onUnauthorized?.();
    throw new ApiException(payload, 401);
  }

  return parse<T>(res);
}

/* Atajos por verbo */
export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  del: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
