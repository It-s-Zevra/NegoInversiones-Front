"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Search, X, Users } from "lucide-react";
import { listLeads, getLead } from "@/lib/api/leads";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/api/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

const leadLabel = (l: Pick<Lead, "full_name" | "phone">) =>
  l.full_name ? `${l.full_name} · ${l.phone}` : l.phone;

interface LeadComboboxProps {
  /** leadId seleccionado (string vacío = sin selección). */
  value: string;
  onChange: (leadId: string, lead?: Lead) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
}

/**
 * Combobox con búsqueda remota de leads (nombre/teléfono/email). Reemplaza el
 * input de id libre: el leadId sale del listado del CRM, no se teclea
 * (ver leads/00-guia-ux §2).
 */
export function LeadCombobox({
  value,
  onChange,
  id,
  invalid,
  disabled,
  placeholder = "Escribe nombre o teléfono…",
  "aria-describedby": ariaDescribedby,
}: LeadComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  // Resolver el nombre del lead seleccionado (al editar llega solo el id).
  useEffect(() => {
    let active = true;
    if (!value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el label al deseleccionar
      setLabel("");
      return;
    }
    getLead(value)
      .then((l) => {
        if (active) setLabel(leadLabel(l));
      })
      .catch(() => {
        if (active) setLabel(`Lead #${value}`);
      });
    return () => {
      active = false;
    };
  }, [value]);

  // Búsqueda con debounce mientras el dropdown está abierto.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      listLeads(
        {
          page: 1,
          limit: 8,
          sortOrder: "DESC",
          sortBy: "created_at",
          ...(query.trim() ? { search: query.trim() } : {}),
        },
        controller.signal
      )
        .then((res) => setResults(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open]);

  // Resaltado de teclado: arranca sin item activo en cada nueva búsqueda.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset del cursor de teclado
    setActiveIndex(-1);
  }, [query, open]);

  // Mantener el item activo visible al navegar con flechas.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(activeIndex))}`
    );
    el?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const select = useCallback(
    (lead: Lead) => {
      onChange(lead.id, lead);
      setLabel(leadLabel(lead));
      setQuery("");
      setOpen(false);
    },
    [onChange]
  );

  function clear() {
    onChange("", undefined);
    setLabel("");
    setQuery("");
  }

  // Navegación por teclado dentro de la propia búsqueda (no toca el contrato).
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (results.length) {
        setActiveIndex((i) => (i + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (results.length) {
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      }
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        select(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  // Mostrado: si hay selección y no estamos escribiendo, muestra el label.
  const displayValue = open ? query : label;
  const showInitialHint = open && !query.trim() && !loading && results.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? optionId(activeIndex) : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={cn(
          "h-10 w-full rounded-lg border bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
          invalid ? "border-danger" : "border-border-strong focus:border-primary"
        )}
      />

      {/* Indicador a la derecha: spinner al buscar, botón limpiar si hay selección. */}
      {open && loading ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Spinner className="h-4 w-4 text-muted" />
        </span>
      ) : value && !disabled ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-subtle transition-colors hover:text-foreground"
          aria-label="Quitar lead"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Resultados de leads"
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-pop"
        >
          {loading ? (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
              <Spinner className="h-4 w-4" />
              <span>Buscando leads…</span>
            </li>
          ) : showInitialHint ? (
            <li className="flex flex-col items-center gap-1 px-3 py-6 text-center">
              <Search className="h-5 w-5 text-subtle" />
              <p className="text-sm font-medium text-foreground">
                Escribe para buscar
              </p>
              <p className="text-xs text-muted">
                Por nombre o número de teléfono del lead.
              </p>
            </li>
          ) : results.length === 0 ? (
            <li className="flex flex-col items-center gap-1 px-3 py-6 text-center">
              <Users className="h-5 w-5 text-subtle" />
              <p className="text-sm font-medium text-foreground">
                Sin resultados
              </p>
              <p className="text-xs text-muted">
                No encontramos leads para “{query.trim()}”. Prueba con otro
                nombre o teléfono.
              </p>
            </li>
          ) : (
            results.map((l, i) => {
              const isSelected = l.id === value;
              const isActive = i === activeIndex;
              return (
                <li key={l.id}>
                  <button
                    id={optionId(i)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(l)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      isActive
                        ? "bg-primary-soft"
                        : "hover:bg-surface-muted"
                    )}
                  >
                    <Avatar
                      src={l.img}
                      name={l.full_name ?? l.phone}
                      className="h-8 w-8"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {l.full_name ?? "Sin nombre"}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {l.phone}
                      </span>
                    </span>
                    {l.stage ? (
                      <Badge tone="primary" className="shrink-0">
                        {l.stage}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
