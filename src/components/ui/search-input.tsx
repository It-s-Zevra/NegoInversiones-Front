"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/** Input de búsqueda con debounce y botón de limpiar. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  debounceMs = 350,
  className,
}: SearchInputProps) {
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  const firstRef = useRef(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Reflejar cambios externos (p. ej. "limpiar filtros").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza valor externo controlado
    setText(value);
  }, [value]);

  // Debounce: emitir el valor tras la pausa (omitiendo el primer render).
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    const t = setTimeout(() => onChangeRef.current(text), debounceMs);
    return () => clearTimeout(t);
  }, [text, debounceMs]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChangeRef.current("");
          }}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-subtle hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
