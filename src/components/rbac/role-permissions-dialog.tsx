"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRole, setRolePermissions } from "@/lib/api/roles";
import { listPermissions } from "@/lib/api/permissions";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import type { Permission } from "@/lib/api/types";

interface Props {
  open: boolean;
  roleId: string | null;
  roleName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function RolePermissionsDialog({ open, roleId, roleName, onClose, onSaved }: Props) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!open || !roleId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el diálogo
    setLoading(true);
    setError(null);
    Promise.all([listPermissions(), getRole(roleId)])
      .then(([perms, role]) => {
        if (!active) return;
        setCatalog(perms);
        setSelected(new Set(role.permissions.map((p) => p.id)));
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, roleId]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function save() {
    if (!roleId) return;
    if (selected.size === 0) {
      setConfirmRevoke(true);
      return;
    }
    doSave();
  }

  async function doSave() {
    if (!roleId) return;
    setSaving(true);
    try {
      await setRolePermissions(roleId, [...selected]);
      toast({ tone: "success", title: "Permisos actualizados" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        // el rol ya no existe: refrescar lista del padre y cerrar
        onSaved();
        onClose();
        return;
      }
      toast({ tone: "error", title: "No se pudieron guardar", description: errorMessage(err) });
      if (err instanceof ApiException && err.statusCode === 422) {
        // catálogo desactualizado: recargar y podar selección a ids vigentes
        listPermissions()
          .then((perms) => {
            setCatalog(perms);
            const ids = new Set(perms.map((p) => p.id));
            setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
          })
          .catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title={`Permisos de ${roleName}`}
      description="Marca los permisos que tendrá este rol. Afecta de inmediato a todos los usuarios con este rol."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading} aria-busy={saving}>
            {saving && <Spinner />}
            Guardar permisos
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid place-items-center py-10">
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-muted">
            {selected.size} de {catalog.length} seleccionados
          </p>
          <div className="max-h-80 space-y-2.5 overflow-auto pr-1">
            {catalog.map((p) => (
              <Checkbox
                key={p.id}
                checked={selected.has(p.id)}
                onCheckedChange={(c) => toggle(p.id, c)}
                label={p.code}
                description={p.name}
              />
            ))}
          </div>
        </div>
      )}
    </Dialog>
    <ConfirmDialog
      open={confirmRevoke}
      onClose={() => setConfirmRevoke(false)}
      onConfirm={() => {
        setConfirmRevoke(false);
        doSave();
      }}
      loading={saving}
      tone="danger"
      title="Revocar todos los permisos…"
      description="Este rol quedará sin permisos y todos los usuarios con este rol perderán el acceso de inmediato."
      confirmLabel="Revocar todos"
    />
    </>
  );
}
