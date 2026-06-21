import { NextResponse, type NextRequest } from "next/server";
import {
  backendUrl,
  clearedCookie,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
} from "@/lib/server/backend";

/**
 * BFF logout: revoca el refresh token en el backend (best-effort) y limpia las
 * cookies de sesión. Idempotente: siempre limpia localmente.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const authorization = req.headers.get("authorization"); // Bearer <access> (actor)

  if (refreshToken) {
    try {
      await fetch(backendUrl("/auth/logout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      /* best-effort: limpiamos localmente igual */
    }
  }

  const out = NextResponse.json({ message: "Session closed successfully." });
  out.cookies.set(clearedCookie(REFRESH_COOKIE));
  out.cookies.set(clearedCookie(SESSION_HINT_COOKIE));
  return out;
}
