"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ApiException } from "@/lib/api/http";
import { errorMessage, mapValidationErrors } from "@/lib/api/errors";
import {
  createUser,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/api/users";
import type { User } from "@/lib/api/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleId: string;
  phone: string;
  department: string;
  isActive: boolean;
}
const empty: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  roleId: "",
  phone: "",
  department: "",
  isActive: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
  user?: User | null;
  roleOptions: SelectOption[];
  onSaved: () => void;
  onNotFound?: () => void;
}

export function UserForm({
  open,
  onClose,
  user,
  roleOptions,
  onSaved,
  onNotFound,
}: Props) {
  const toast = useToast();
  const isEdit = !!user;
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga al abrir
    setErrors({});
    setForm(
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            password: "",
            roleId: user.roleId,
            phone: user.phone ?? "",
            department: user.department ?? "",
            isActive: user.isActive,
          }
        : { ...empty, roleId: roleOptions[0]?.value ?? "" }
    );
  }, [open, user, roleOptions]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Obligatorio.";
    else if (form.firstName.trim().length > 120) next.firstName = "Máximo 120 caracteres.";
    if (!form.lastName.trim()) next.lastName = "Obligatorio.";
    else if (form.lastName.trim().length > 120) next.lastName = "Máximo 120 caracteres.";
    if (!EMAIL_RE.test(form.email)) next.email = "Email inválido.";
    if (!form.roleId) next.roleId = "Selecciona un rol.";
    if (form.phone.trim().length > 40) next.phone = "Máximo 40 caracteres.";
    if (form.department.trim().length > 120) next.department = "Máximo 120 caracteres.";
    if (!isEdit && (form.password.length < 8 || form.password.length > 128))
      next.password = "Entre 8 y 128 caracteres.";
    if (isEdit && form.password && (form.password.length < 8 || form.password.length > 128))
      next.password = "Entre 8 y 128 caracteres.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        const body: UpdateUserInput = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          roleId: form.roleId,
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        };
        await updateUser(user!.id, body);
      } else {
        const body: CreateUserInput = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
          roleId: form.roleId,
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
        };
        await createUser(body);
      }
      toast({ tone: "success", title: isEdit ? "Usuario actualizado" : "Usuario creado" });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 400) {
        setErrors(mapValidationErrors(err, Object.keys(empty)).fieldErrors);
      } else if (err instanceof ApiException && err.statusCode === 409) {
        setErrors({ email: err.messages[0] });
      } else if (err instanceof ApiException && err.statusCode === 422) {
        setErrors({ roleId: err.messages[0] });
      } else if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "error", title: errorMessage(err) });
        onClose();
        onNotFound?.();
      } else {
        toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? "Editar usuario" : "Nuevo usuario"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" size="sm" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="u-fn" required error={errors.firstName}>
            <Input id="u-fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)}
              invalid={!!errors.firstName} aria-describedby={errors.firstName ? "u-fn-error" : undefined} />
          </Field>
          <Field label="Apellido" htmlFor="u-ln" required error={errors.lastName}>
            <Input id="u-ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)}
              invalid={!!errors.lastName} aria-describedby={errors.lastName ? "u-ln-error" : undefined} />
          </Field>
        </div>
        <Field label="Email" htmlFor="u-email" required error={errors.email}>
          <Input id="u-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
            invalid={!!errors.email} aria-describedby={errors.email ? "u-email-error" : undefined}
            placeholder="persona@negoinversiones.com" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rol" htmlFor="u-role" required error={errors.roleId}>
            <Select id="u-role" options={roleOptions} placeholder="Selecciona un rol"
              value={form.roleId} onChange={(e) => set("roleId", e.target.value)}
              invalid={!!errors.roleId} aria-describedby={errors.roleId ? "u-role-error" : undefined} />
          </Field>
          <Field
            label={isEdit ? "Nueva contraseña" : "Contraseña"}
            htmlFor="u-pass"
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? "Déjala vacía para no cambiarla." : undefined}
          >
            <Input id="u-pass" type="password" value={form.password} autoComplete="new-password"
              onChange={(e) => set("password", e.target.value)}
              invalid={!!errors.password}
              aria-describedby={errors.password ? "u-pass-error" : isEdit ? "u-pass-hint" : undefined} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Teléfono" htmlFor="u-phone" error={errors.phone}>
            <Input id="u-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              invalid={!!errors.phone} aria-describedby={errors.phone ? "u-phone-error" : undefined}
              placeholder="+59170000000" />
          </Field>
          <Field label="Departamento" htmlFor="u-dept" error={errors.department}>
            <Input id="u-dept" value={form.department} onChange={(e) => set("department", e.target.value)}
              invalid={!!errors.department} aria-describedby={errors.department ? "u-dept-error" : undefined}
              placeholder="Comercial" />
          </Field>
        </div>
        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cuenta activa</p>
              <p className="text-xs text-muted">Desactívala para bloquear el acceso.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} aria-label="Cuenta activa" />
          </div>
        )}
      </form>
    </Dialog>
  );
}
