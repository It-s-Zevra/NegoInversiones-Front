/**
 * Almacenamiento de sesión del cliente.
 *  - accessToken: en MEMORIA (corto, 15 min). Nunca en localStorage.
 *  - refreshToken: NO se toca desde el cliente. Vive en una cookie HttpOnly
 *    (ni_rt) que gestiona el BFF (src/app/api/auth/*). JS no puede leerla.
 *  - ni_auth: cookie legible (solo "1"/ausente) — pista para decidir si hidratar.
 *    No es un secreto; el control real lo hacen el BFF, el proxy y el backend.
 */

export const SESSION_HINT_COOKIE = "ni_auth";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** ¿Hay (probablemente) una sesión activa? Pista para rehidratar al cargar. */
export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE}=1`).test(document.cookie);
}

/** Limpia la sesión local: access token en memoria + pista legible. */
export function clearSession(): void {
  accessToken = null;
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}
