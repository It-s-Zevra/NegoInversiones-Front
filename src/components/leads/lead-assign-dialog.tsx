"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { assignLead, bulkAssignLeads } from "@/lib/api/leads";

interface LeadAssignDialogProps {
  open: boolean;
  onClose: () => void;
  /** Uno → asignación individual; varios → asignación masiva. */
  leadIds: string[];
  executiveOptions: SelectOption[];
  onAssigned: () => void;
}

export function LeadAssignDialog({
  open,
  onClose,
  leadIds,
  executiveOptions,
  onAssigned,
}: LeadAssignDialogProps) {
  const toast = useToast();
  const [executiveId, setExecutiveId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const isBulk = leadIds.length > 1;

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al abrir
    setExecutiveId("");
    setError(undefined);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!executiveId) {
      setError("Selecciona un ejecutivo.");
      return;
    }
    setSubmitting(true);
    try {
      if (isBulk) {
        const res = await bulkAssignLeads(leadIds, executiveId);
        toast({
          tone: "success",
          title: `Asignados ${res.affected} lead${res.affected === 1 ? "" : "s"}`,
        });
      } else {
        await assignLead(leadIds[0], executiveId);
        toast({ tone: "success", title: "Lead asignado" });
      }
      onAssigned();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setError(err.messages[0] ?? "Referencia inválida.");
      }
      toast({
        tone: "error",
        title: "No se pudo asignar",
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      size="sm"
      title={isBulk ? `Asignar ${leadIds.length} leads` : "Asignar ejecutivo"}
      description="El ejecutivo quedará a cargo del seguimiento."
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="assign-form"
            size="sm"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Spinner />}
            Asignar
          </Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit} noValidate>
        <Field label="Ejecutivo" htmlFor="a-exec" required error={error}>
          <Select
            id="a-exec"
            options={executiveOptions}
            placeholder="Selecciona un ejecutivo"
            value={executiveId}
            onChange={(e) => setExecutiveId(e.target.value)}
            invalid={!!error}
          />
        </Field>
      </form>
    </Dialog>
  );
}
