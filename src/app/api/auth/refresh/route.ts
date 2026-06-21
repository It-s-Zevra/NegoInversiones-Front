import { NextResponse, type NextRequest } from "next/server";
import {
  backendUrl,
  refreshCookie,
  hintCookie,
  clearedCookie,
  safeJson,
  errorPayload,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
} from "@/lib/server/backend";

/**
 * BFF refresh: lee el refresh token (cookie HttpOnly), lo rota contra el backend
 * y reescribe la cookie. Solo limpia la sesión ante 401 (refresh muerto);
 * un 5xx/429 transitorio se propaga sin destruir la sesión.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      errorPayload(401, "Unauthorized", "No active session"),
      { status: 401 }
    );
  }

  let res: Response;
  try {
    res = await fetch(backendUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Error de red: transitorio, NO borrar la cookie.
    return NextResponse.json(
      errorPayload(502, "Bad Gateway", "No se pudo conectar con el servidor"),
      { status: 502 }
    );
  }

  const data = safeJson(await res.text());

  if (!res.ok || !data?.accessToken) {
    const status = res.ok ? 502 : res.status;
    const out = NextResponse.json(
      data ?? errorPayload(status, "Error", "Error"),
      { status }
    );
    // Solo el 401 es sesión irrecuperable → limpiar cookies.
    if (status === 401) {
      out.cookies.set(clearedCookie(REFRESH_COOKIE));
      out.cookies.set(clearedCookie(SESSION_HINT_COOKIE));
    }
    return out;
  }

  const out = NextResponse.json({
    accessToken: data.accessToken,
    tokenType: data.tokenType,
    expiresIn: data.expiresIn,
  });
  out.cookies.set(refreshCookie(String(data.refreshToken)));
  out.cookies.set(hintCookie());
  return out;
}
