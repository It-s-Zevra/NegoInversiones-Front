/**
 * Servicios de autenticación del cliente.
 *  - login/logout pasan por el BFF (/api/auth/*) para que el refresh token
 *    quede en una cookie HttpOnly y nunca toque JS.
 *  - getMe va directo al backend con el access token (Bearer en memoria).
 *  - El refresh es interno al cliente HTTP (ver http.ts → performRefresh).
 */
import { apiRequest, ApiException } from "./http";
import { ENDPOINTS } from "./config";
import { getAccessToken } from "@/lib/auth/storage";
import type { MeResponse } from "./types";

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

async function bff<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "include", ...init });
  } catch {
    throw new ApiException(null, 0); // error de red
  }
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) throw new ApiException((payload as never) ?? null, res.status);
  return payload as T;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return bff<LoginResult>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ message: string }> {
  const token = getAccessToken();
  return bff<{ message: string }>("/api/auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>(ENDPOINTS.auth.me);
}
