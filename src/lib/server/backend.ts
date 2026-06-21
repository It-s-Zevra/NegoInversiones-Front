/**
 * Helpers SOLO de servidor (route handlers del BFF de auth).
 * El refresh token vive en una cookie HttpOnly que el navegador nunca expone a JS;
 * estos handlers son el único punto que la lee/escribe.
 */
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const BACKEND_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3002";

export const BACKEND_PREFIX = "/api/v1";

export const backendUrl = (path: string): string =>
  `${BACKEND_URL}${BACKEND_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;

const isProd = process.env.NODE_ENV === "production";

export const REFRESH_COOKIE = "ni_rt"; // HttpOnly (secreto)
export const SESSION_HINT_COOKIE = "ni_auth"; // legible (solo una pista de UI)
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días (vida del refresh token)

export function refreshCookie(value: string): ResponseCookie {
  return {
    name: REFRESH_COOKIE,
    value,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function hintCookie(): ResponseCookie {
  return {
    name: SESSION_HINT_COOKIE,
    value: "1",
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearedCookie(name: string): ResponseCookie {
  return {
    name,
    value: "",
    httpOnly: name === REFRESH_COOKIE,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

export function safeJson(text: string): Record<string, unknown> | null {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function errorPayload(statusCode: number, error: string, message: string) {
  return { statusCode, error, message, timestamp: new Date().toISOString() };
}
