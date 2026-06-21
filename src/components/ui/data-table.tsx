"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "./skeleton";
import { EmptyState, ErrorState } from "./states";
import { cn } from "@/lib/utils";
import type { SortOrder } from "@/lib/hooks/use-list";

export interface Column<T> {
  key: string;
  header: string;
  /** Si se define, la columna es ordenable por ese campo (allowlist del backend). */
  sortKey?: string;
  align?: "left" | "right" | "center";
  className?: string;
  /** Oculta la columna en móvil (la tarjeta móvil se arma aparte). */
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  error?: unknown;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Nombre accesible de la fila clicable (p. ej. "Ver Vista Verde"). */
  rowLabel?: (row: T) => string;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSort?: (key: string) => void;
  onRetry?: () => void;
  /** Render de tarjeta para móvil; si no se pasa, se arma desde las columnas. */
  mobileCard?: (row: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  skeletonRows?: number;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  rowKey,
  onRowClick,
  rowLabel,
  sortBy,
  sortOrder,
  onSort,
  onRetry,
  mobileCard,
  emptyTitle,
  emptyDescription,
  emptyAction,
  skeletonRows = 6,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const onRowKeyDown = (e: React.KeyboardEvent, row: T) => {
    if (!onRowClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick(row);
    }
  };

  if (!loading && data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      {/* Tabla (desktop) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              {columns.map((col) => {
                const sortable = !!col.sortKey && !!onSort;
                const active = sortable && sortBy === col.sortKey;
                return (
                  <th
                    key={col.key}
                    aria-sort={
                      active
                        ? sortOrder === "ASC"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    className={cn(
                      "px-5 py-2.5 font-medium",
                      col.align && alignClass[col.align]
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort!(col.sortKey!)}
                        aria-label={`Ordenar por ${col.header}`}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground",
                          active && "text-foreground"
                        )}
                      >
                        {col.header}
                        {active ? (
                          sortOrder === "ASC" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3.5">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick ? (e) => onRowKeyDown(e, row) : undefined
                    }
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick ? rowLabel?.(row) : undefined}
                    className={cn(
                      "border-b border-border last:border-0",
                      onRowClick &&
                        "cursor-pointer hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-5 py-3 text-foreground",
                          col.align && alignClass[col.align],
                          col.className
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas (móvil) */}
      <ul className="divide-y divide-border md:hidden">
        {loading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <li key={i} className="px-5 py-4">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </li>
            ))
          : data.map((row) => (
              <li
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => onRowKeyDown(e, row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? rowLabel?.(row) : undefined}
                className={cn(
                  "px-5 py-3.5",
                  onRowClick &&
                    "cursor-pointer hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                )}
              >
                {mobileCard ? (
                  mobileCard(row)
                ) : (
                  <div className="space-y-1.5">
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-xs text-subtle">{col.header}</span>
                        <span className="text-foreground">{col.render(row)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
      </ul>
    </>
  );
}
