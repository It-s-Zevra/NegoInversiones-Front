import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protección de rutas server-side por presencia de la cookie de sesión (ni_rt).
 * (En Next 16 esta convención se llama "proxy", antes "middleware").
 * No valida el JWT (eso lo hace el backend); solo evita el flash de contenido
 * protegido y mantiene coherente el guard del cliente (RequireAuth).
 */
const SESSION_COOKIE = "ni_rt";
const PUBLIC_PATHS = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todo excepto /api (el BFF gestiona su propia auth), assets de Next y archivos con extensión.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
