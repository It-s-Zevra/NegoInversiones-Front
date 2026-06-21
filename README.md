# NegoInversiones · Panel Admin

Panel de administración (SPA interna) de NegoInversiones. Gestiona proyectos,
unidades, ventas, financiamiento, agendas/disponibilidad, base de conocimiento,
RBAC (usuarios/roles/permisos), clientes de API, auditoría y notificaciones.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript.

## Requisitos

- Node.js 20+ (recomendado 22)
- npm

## Configuración de entorno

La app consume el backend (NestJS) vía dos variables. Crea `.env.local` (no se
versiona) a partir de `.env.example`:

```bash
cp .env.example .env.local
```

| Variable | Usada por | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Cliente (navegador) | Llamadas directas con Bearer (auth/me, listados, módulos). Se inyecta en el bundle. |
| `API_BASE_URL` | BFF (server, `/api/auth/*`) | Proxy de login/refresh/logout; mantiene el refresh token en cookie **HttpOnly**. Si falta, usa `NEXT_PUBLIC_API_BASE_URL`. |

Backend de producción (Railway):

```
NEXT_PUBLIC_API_BASE_URL=https://negoinversiones-back-production.up.railway.app
API_BASE_URL=https://negoinversiones-back-production.up.railway.app
```

> El backend debe permitir el origen del panel en `CORS_ORIGIN` (las llamadas del
> cliente usan Bearer sin cookies de origen cruzado).

## Desarrollo

```bash
npm install
npm run dev          # contra el backend de .env.local (Railway u otro)
```

Abrir http://localhost:3000 — redirige a `/login`.

### Modo offline (mock API)

Si no quieres depender del backend real, hay un mock local en
[`scripts/mock-api.mjs`](scripts/mock-api.mjs) que implementa todos los flujos:

```bash
npm run dev:mock     # mock en :3002 + Next en :3000
```

Apunta `.env.local` a `http://localhost:3002`. Credenciales demo del mock:
`admin@negoinversiones.com` / `Sup3rS3cret!` (los datos viven en memoria).

## Scripts

| Script | Acción |
|--------|--------|
| `npm run dev` | Servidor de desarrollo |
| `npm run dev:mock` | Mock API + dev |
| `npm run mock:api` | Solo el mock API (:3002) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |

## Despliegue en Vercel

1. Importa el repo en Vercel (detecta Next.js automáticamente; no requiere
   `vercel.json`).
2. En **Project → Settings → Environment Variables** define, para *Production*
   (y *Preview* si aplica):
   - `NEXT_PUBLIC_API_BASE_URL` = URL del backend (Railway)
   - `API_BASE_URL` = misma URL del backend
3. Deploy. Tras el primer deploy, agrega el dominio de Vercel al `CORS_ORIGIN`
   del backend.

## Arquitectura (resumen)

- **Auth:** access token en memoria; refresh token en cookie **HttpOnly** vía un
  BFF de route handlers (`src/app/api/auth/*`); auto-refresh ante 401 (single-flight
  + Web Locks); protección de rutas en `src/proxy.ts`.
- **Datos:** cliente HTTP en `src/lib/api/http.ts`; un servicio por recurso en
  `src/lib/api/*`; hooks reutilizables `useList` / `useResource`.
- **UI:** componentes minimalistas en `src/components/ui/*` (DataTable, Dialog,
  Toast, etc.); shell responsive en `src/components/layout/*`.
- **Permisos:** pista de UI en `src/lib/auth/permissions.ts`; el backend es la
  autoridad final (responde 403).
