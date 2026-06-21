"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Paginated, PaginationMeta } from "@/lib/api/types";
import { ApiException } from "@/lib/api/http";

export type SortOrder = "ASC" | "DESC";
export type ListFilters = Record<string, string | undefined>;

/** Query combinada (paginación + orden + búsqueda + filtros) que recibe el fetcher. */
export type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder: SortOrder;
} & Record<string, string | number | undefined>;

export type ListFetcher<T> = (
  query: ListQuery,
  signal?: AbortSignal
) => Promise<Paginated<T>>;

interface UseListOptions<F extends ListFilters> {
  initialSortBy?: string;
  initialSortOrder?: SortOrder;
  initialLimit?: number;
  initialFilters?: F;
}

/**
 * Hook genérico para listados paginados del panel.
 * Maneja page/limit/search/sortBy/sortOrder + filtros, cancela peticiones
 * obsoletas (AbortController) y expone estados loading/error.
 */
export function useList<T, F extends ListFilters = ListFilters>(
  fetcher: ListFetcher<T>,
  options: UseListOptions<F> = {}
) {
  const {
    initialSortBy,
    initialSortOrder = "DESC",
    initialLimit = 20,
    initialFilters = {} as F,
  } = options;

  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);
  const [search, setSearchState] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [filters, setFiltersState] = useState<F>(initialFilters);

  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiException | null>(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga al iniciar el fetch
    setLoading(true);
    setError(null);

    const query: ListQuery = {
      page,
      limit,
      sortOrder,
      ...(search ? { search } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...filters,
    };

    fetcherRef
      .current(query, controller.signal)
      .then((res) => {
        if (!active) return;
        setItems(res.data);
        setMeta(res.meta);
        // Si la página quedó fuera de rango (p. ej. al eliminar el último item),
        // saltar a la última válida (re-dispara el efecto).
        if (res.meta.totalPages > 0 && page > res.meta.totalPages) {
          setPage(res.meta.totalPages);
        }
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof ApiException ? err : new ApiException(null, 0));
        setItems([]);
        setMeta(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, limit, search, sortBy, sortOrder, filters, reloadKey]);

  // Mutadores: cualquier cambio de filtro/orden/búsqueda vuelve a la página 1.
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string | undefined) => {
    setFiltersState((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  }, []);

  const setLimit = useCallback((value: number) => {
    setLimitState(value);
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (key: string) => {
      setPage(1);
      if (sortBy === key) {
        setSortOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortBy(key);
        setSortOrder("ASC");
      }
    },
    [sortBy]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setSearchState("");
    setSortBy(initialSortBy);
    setSortOrder(initialSortOrder);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    filters,
    setPage,
    setLimit,
    setSearch,
    setFilter,
    toggleSort,
    resetFilters,
    refetch,
  };
}
