"use client";

import { useState } from "react";
import { Copy, Check, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ApiClientKeyDialog({
  apiKey,
  onClose,
}: {
  apiKey: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  }

  return (
    <Dialog
      open={!!apiKey}
      onClose={onClose}
      title="API key generada"
      description="Cópiala ahora: no se volverá a mostrar."
      footer={<Button size="sm" onClick={onClose}>Entendido</Button>}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Guárdala en un lugar seguro. El sistema solo almacena su hash.</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
            {apiKey}
          </code>
          <Button variant="secondary" size="icon" onClick={copy} aria-label="Copiar API key">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
