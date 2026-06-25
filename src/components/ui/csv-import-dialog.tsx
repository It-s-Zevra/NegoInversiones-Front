"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import {
  IMPORT_MAX_BYTES,
  type BulkImportStatus,
  type CsvColumn,
  type CsvImporter,
} from "@/lib/api/csv-import";

interface Props {
  open: boolean;
  title: string;
  importer: CsvImporter;
  onClose: () => void;
  /** Se llama al terminar (completed/failed) para refrescar el listado. */
  onImported: () => void;
}

const POLL_MS = 2000;
const DONE = new Set(["completed", "failed"]);

/** Valor especial para "no asignar esta columna" en los <Select>. */
const UNMAPPED = "";

/** Normaliza una cabecera para comparar nombres (minúsculas, sin acentos,
    espacios/guiones colapsados). Sirve para el auto-emparejado. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

/** Lee la primera línea de un CSV y devuelve las cabeceras (trim, sin comillas). */
function parseHeaderLine(line: string): string[] {
  return line
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").trim())
    .filter((h) => h.length > 0);
}

/** Lee en cliente la primera línea del CSV para obtener sus cabeceras. */
function readCsvHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
      resolve(parseHeaderLine(firstLine));
    };
    // Basta con un trozo del inicio para la cabecera.
    reader.readAsText(file.slice(0, 64 * 1024));
  });
}

/** Auto-empareja cada columna canónica con la cabecera del archivo que coincide
    por nombre (exacto o normalizado). Devuelve { canonicalKey: csvHeader }. */
function autoMap(columns: CsvColumn[], headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const col of columns) {
    const normKey = normalizeHeader(col.key);
    const normLabel = normalizeHeader(col.label);
    const match = headers.find((h) => {
      const nh = normalizeHeader(h);
      return nh === normKey || nh === normLabel;
    });
    if (match) result[col.key] = match;
  }
  return result;
}

/** Genera y descarga una plantilla CSV con la fila de cabeceras canónicas. */
function downloadTemplate(columns: CsvColumn[], filename: string) {
  const header = columns.map((c) => c.key).join(",");
  const example = columns.map((c) => c.example ?? "").join(",");
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CsvImportDialog({ open, title, importer, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [headersFailed, setHeadersFailed] = useState(false);
  // Mapeo: { canonicalKey: csvHeader }. "" = sin asignar.
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<BulkImportStatus | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const importerRef = useRef(importer);
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    importerRef.current = importer;
    onImportedRef.current = onImported;
  });

  const columns = importer.columns;

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir
    setFile(null);
    setHeaders(null);
    setHeadersFailed(false);
    setMapping({});
    setUploading(false);
    setJobId(null);
    setStatus(null);
    setPollTick(0);
    setError(null);
  }, [open]);

  const done = !!status && DONE.has(status.status);

  // Polling del estado del job (vía pollTick) hasta completed/failed.
  useEffect(() => {
    if (!jobId || done) return;
    let active = true;
    const t = setTimeout(async () => {
      if (!active) return;
      try {
        const s = await importerRef.current.status(jobId);
        if (!active) return;
        setStatus(s);
        if (DONE.has(s.status)) onImportedRef.current();
        else setPollTick((n) => n + 1);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiException && err.statusCode === 404) {
          setError("La importación expiró o ya no está disponible.");
          setJobId(null);
        } else {
          // 5xx/red transitorio: reintentar en el siguiente ciclo
          setPollTick((n) => n + 1);
        }
      }
    }, POLL_MS);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [jobId, pollTick, done]);

  // Columnas obligatorias que aún no tienen una cabecera asignada.
  const missingRequired = useMemo(
    () =>
      headers
        ? columns.filter((c) => c.required && !mapping[c.key])
        : [],
    [columns, mapping, headers]
  );

  // Opciones de cabeceras detectadas para los <Select>.
  const headerOptions = useMemo(
    () => (headers ?? []).map((h) => ({ value: h, label: h })),
    [headers]
  );

  async function onPickFile(picked: File | null) {
    setError(null);
    setFile(picked);
    setHeaders(null);
    setHeadersFailed(false);
    setMapping({});
    if (!picked) return;
    try {
      const detected = await readCsvHeaders(picked);
      if (detected.length === 0) {
        setHeadersFailed(true);
        return;
      }
      setHeaders(detected);
      setMapping(autoMap(columns, detected));
    } catch {
      setHeadersFailed(true);
    }
  }

  function setColumnMapping(key: string, header: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (header === UNMAPPED) delete next[key];
      else next[key] = header;
      return next;
    });
  }

  // ¿Se puede importar? Necesita archivo, tamaño válido y, si se leyeron
  // cabeceras, que todas las obligatorias estén asignadas.
  const canImport =
    !!file &&
    !uploading &&
    (headersFailed || !headers || missingRequired.length === 0);

  async function startImport() {
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setError("El archivo supera el máximo permitido (5 MB).");
      return;
    }
    // Construir el mapping JSON solo con columnas mapeadas. Si no se pudieron
    // leer cabeceras, no se envía mapping (se asume CSV ya canónico).
    let mappingJson: string | undefined;
    if (headers && Object.keys(mapping).length > 0) {
      mappingJson = JSON.stringify(mapping);
    }
    setError(null);
    setUploading(true);
    try {
      const res = await importerRef.current.upload(file, mappingJson);
      setStatus({ jobId: res.jobId, status: "queued", progress: 0 });
      setJobId(res.jobId);
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 413) {
        setError("El archivo supera el máximo permitido (5 MB).");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={uploading ? () => {} : onClose}
      title={title}
      description="Sube un archivo CSV (máx 5 MB). Te ayudamos a relacionar las columnas de tu archivo con las que el sistema necesita."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading}>
            {done ? "Cerrar" : "Cancelar"}
          </Button>
          {!jobId && (
            <Button size="sm" onClick={startImport} disabled={!canImport} aria-busy={uploading}>
              {uploading && <Spinner />}
              Importar
            </Button>
          )}
          {jobId && !done && (
            <Button size="sm" disabled aria-busy>
              <Spinner />
              Procesando…
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}

        {!jobId ? (
          <>
            {/* Paso 1: plantilla */}
            <div className="rounded-card border border-border bg-surface-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">
                1. Descarga la plantilla
              </p>
              <p className="mt-1 text-xs text-muted">
                Un CSV es una tabla simple separada por comas. Cada columna es un
                dato. Descarga la plantilla con las columnas correctas, llénala
                en Excel o Google Sheets y guárdala como CSV.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => downloadTemplate(columns, "plantilla-import.csv")}
              >
                <Download className="h-4 w-4" />
                Descargar plantilla CSV
              </Button>
            </div>

            {/* Paso 2: archivo */}
            <div>
              <p className="text-sm font-medium text-foreground">
                2. Elige tu archivo
              </p>
              <label
                htmlFor="csv-file"
                className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface px-3 py-3 text-sm text-muted transition-colors hover:border-primary hover:text-foreground"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {file ? file.name : "Selecciona un archivo CSV de tu computadora"}
                </span>
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
                className="sr-only"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Paso 3: mapeo visual */}
            {file && (
              <div>
                <p className="text-sm font-medium text-foreground">
                  3. Relaciona las columnas
                </p>

                {headersFailed ? (
                  <p className="mt-1 rounded-lg border border-warning/40 bg-warning-soft/50 p-2.5 text-xs text-foreground">
                    No pudimos leer las columnas de tu archivo. Puedes continuar
                    igual si tu archivo usa exactamente las columnas de la
                    plantilla. Si no, descarga la plantilla y vuelve a intentarlo.
                  </p>
                ) : !headers ? (
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <Spinner />
                    Leyendo las columnas de tu archivo…
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted">
                      Para cada dato que el sistema necesita (izquierda), indica
                      qué columna de tu archivo le corresponde (derecha). Ya
                      asignamos las que coinciden por nombre.
                    </p>
                    <div className="mt-3 space-y-3">
                      {columns.map((col) => {
                        const isMissing =
                          col.required && !mapping[col.key];
                        return (
                          <div
                            key={col.key}
                            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr] sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {col.label}
                                </span>
                                <Badge tone={col.required ? "warning" : "neutral"}>
                                  {col.required ? "obligatoria" : "opcional"}
                                </Badge>
                              </div>
                              {col.example && (
                                <p className="text-xs text-subtle">
                                  Ejemplo: {col.example}
                                </p>
                              )}
                            </div>
                            <Select
                              aria-label={`Columna para ${col.label}`}
                              value={mapping[col.key] ?? UNMAPPED}
                              invalid={isMissing}
                              options={headerOptions}
                              placeholder="— elegir columna —"
                              onChange={(e) =>
                                setColumnMapping(col.key, e.target.value)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>

                    {missingRequired.length > 0 && (
                      <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft/50 p-2.5 text-xs text-danger">
                        Falta asignar:{" "}
                        {missingRequired.map((c) => c.label).join(", ")}.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : !done ? (
          <div>
            <p className="text-sm text-foreground">Procesando importación…</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${status?.progress ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              {status?.status} · {status?.progress ?? 0}%
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {status?.summary && (
              <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {status.summary.created} creadas · {status.summary.failed} con error ·{" "}
                  {status.summary.total} en total
                </p>
              </div>
            )}
            {status?.failedReason && (
              <p className="text-sm text-danger">
                La importación falló: {status.failedReason}
              </p>
            )}
            {status?.errors && status.errors.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Fila</th>
                      <th className="px-3 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {status.errors.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 align-top text-muted">{e.row}</td>
                        <td className="px-3 py-2 text-foreground">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {status?.summary && status.summary.failed === 0 && !status.failedReason && (
              <p className="text-sm text-success">Importación completada sin errores.</p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
