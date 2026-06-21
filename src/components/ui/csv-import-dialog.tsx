"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import {
  IMPORT_MAX_BYTES,
  type BulkImportStatus,
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

export function CsvImportDialog({ open, title, importer, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState("");
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

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir
    setFile(null);
    setMapping("");
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

  async function startImport() {
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setError("El archivo supera el máximo permitido (5 MB).");
      return;
    }
    const m = mapping.trim();
    if (m) {
      try {
        JSON.parse(m);
      } catch {
        setError('El mapeo debe ser JSON válido, p. ej. {"code":"Codigo"}.');
        return;
      }
    }
    setError(null);
    setUploading(true);
    try {
      const res = await importerRef.current.upload(file, m || undefined);
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
      description="Sube un CSV (máx 5 MB). El proceso es asíncrono; el progreso se muestra aquí."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={uploading}>
            {done ? "Cerrar" : "Cancelar"}
          </Button>
          {!jobId && (
            <Button size="sm" onClick={startImport} disabled={!file || uploading} aria-busy={uploading}>
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
            <Field label="Archivo CSV" htmlFor="csv-file">
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError(null);
                }}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
              />
            </Field>
            <p className="text-xs text-muted">
              Columnas obligatorias: {importer.requiredColumns.join(", ")}. Si tu CSV usa otras
              cabeceras, indica el mapeo abajo.
            </p>
            <Field label="Mapeo de columnas (JSON, opcional)" htmlFor="csv-mapping">
              <Textarea
                id="csv-mapping"
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                placeholder='{"code":"Codigo","type":"Tipo"}'
                rows={2}
              />
            </Field>
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
