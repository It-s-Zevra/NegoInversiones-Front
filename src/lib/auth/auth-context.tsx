"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import { setOnUnauthorized } from "@/lib/api/http";
import {
  setAccessToken,
  clearSession,
  hasSessionHint,
} from "@/lib/auth/storage";
import { roleCan } from "@/lib/auth/permissions";
import type { MeResponse } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: MeResponse | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Pista de UI por permiso (no es autoridad: el backend manda con el 403). */
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const reset = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Sesión irrecuperable (refresh agotado): limpiar y mandar a login.
  useEffect(() => {
    setOnUnauthorized(() => {
      reset();
      router.replace("/login");
    });
    return () => setOnUnauthorized(null);
  }, [reset, router]);

  // Rehidratación al cargar: si hay pista de sesión, recuperar el perfil.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    let active = true;
    (async () => {
      if (!hasSessionHint()) {
        if (active) setStatus("unauthenticated");
        return;
      }
      try {
        // getMe dispara un refresh automático (no hay access token en memoria todavía).
        const me = await authApi.getMe();
        if (active) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch {
        if (active) reset();
      }
    })();

    return () => {
      active = false;
    };
  }, [reset]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await authApi.login(email, password); // lanza ApiException si falla
      setAccessToken(accessToken);
      try {
        const me = await authApi.getMe();
        setUser(me);
        setStatus("authenticated");
      } catch (err) {
        reset(); // estado consistente: todo limpio si no pudimos cargar el perfil
        throw err;
      }
    },
    [reset]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // el BFF revoca y limpia la cookie HttpOnly
    } catch {
      // best-effort: limpiamos localmente igual
    }
    reset();
    router.replace("/login");
  }, [reset, router]);

  const can = useCallback(
    (permission: string) => roleCan(user?.role, permission),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, status, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
