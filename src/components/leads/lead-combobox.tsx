"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { listLeads, getLead } from "@/lib/api/leads";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/api/types";

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
  placeholder = "Buscar lead por nombre o teléfono…",
  "aria-describedby": ariaDescribedby,
}: LeadComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

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

  // Mostrado: si hay selección y no estamos escribiendo, muestra el label.
  const displayValue = open ? query : label;

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
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedby}
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={cn(
          "h-10 w-full rounded-lg border bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
          invalid ? "border-danger" : "border-border-strong focus:border-primary"
        )}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-subtle hover:text-foreground"
          aria-label="Quitar lead"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-pop"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Sin resultados</li>
          ) : (
            results.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.id === value}
                  onClick={() => select(l)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <span className="font-medium text-foreground">
                    {l.full_name ?? "Sin nombre"}
                  </span>
                  <span className="text-xs text-muted">
                    {l.phone}
                    {l.stage ? ` · ${l.stage}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
