"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiException } from "@/lib/api/http";

export type ResourceFetcher<T> = (signal?: AbortSignal) => Promise<T>;

/**
 * Hook genérico para cargar UN recurso (detalle por id, etc.).
 * Cancela peticiones obsoletas y expone data/loading/error + refetch.
 * `deps` controla la recarga (p. ej. [id]).
 */
export function useResource<T>(
  fetcher: ResourceFetcher<T>,
  deps: React.DependencyList
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiException | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  /** Actualiza el dato en memoria (p. ej. tras una mutación que devuelve la entidad). */
  const mutate = useCallback((next: T) => setData(next), []);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga al iniciar el fetch
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof ApiException ? err : new ApiException(null, 0));
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { data, loading, error, refetch, mutate };
}
