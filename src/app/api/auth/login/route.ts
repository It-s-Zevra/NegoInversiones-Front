import { NextResponse, type NextRequest } from "next/server";
import {
  backendUrl,
  refreshCookie,
  hintCookie,
  safeJson,
  errorPayload,
} from "@/lib/server/backend";

/**
 * BFF login: reenvía credenciales al backend, guarda el refresh token en una
 * cookie HttpOnly (ni_rt) y devuelve al cliente SOLO el access token.
 */
export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* body inválido → backend devolverá 400 */
  }

  let res: Response;
  try {
    res = await fetch(backendUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      errorPayload(502, "Bad Gateway", "No se pudo conectar con el servidor"),
      { status: 502 }
    );
  }

  const data = safeJson(await res.text());

  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(
      data ?? errorPayload(res.status, "Error", "Error"),
      { status: res.ok ? 502 : res.status }
    );
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
