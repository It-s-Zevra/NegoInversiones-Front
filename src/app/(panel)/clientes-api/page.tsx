"use client";

import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiClientForm } from "@/components/api-clients/api-client-form";
import { ApiClientKeyDialog } from "@/components/api-clients/api-client-key-dialog";
import { ApiClientScopesDialog } from "@/components/api-clients/api-client-scopes-dialog";
import { ApiScopeForm } from "@/components/api-clients/api-scope-form";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/lib/hooks/use-resource";
import { useAuth } from "@/lib/auth/auth-context";
import {
  listApiClients,
  listApiScopes,
  revokeApiClient,
} from "@/lib/api/api-clients";
import { ApiException } from "@/lib/api/http";
import { errorMessage } from "@/lib/api/errors";
import { formatRelativeTime, formatDate } from "@/lib/format";
import type { ApiClient, ApiScope } from "@/lib/api/types";

export default function ApiClientsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("api-clients:write");
  const canDelete = can("api-clients:delete");
  const canScopeWrite = can("api-scopes:write");

  const clientsFetcher = useCallback((s?: AbortSignal) => listApiClients(s), []);
  const clients = useResource<ApiClient[]>(clientsFetcher, []);
  const scopesFetcher = useCallback((s?: AbortSignal) => listApiScopes(s), []);
  const scopes = useResource<ApiScope[]>(scopesFetcher, []);
  const scopeCatalog = scopes.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiClient | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [scopesClient, setScopesClient] = useState<ApiClient | null>(null);
  /** Scope ids conocidos por cliente (el listado no los trae). */
  const [knownScopeIds, setKnownScopeIds] = useState<Record<string, string[]>>({});
  const [revoking, setRevoking] = useState<ApiClient | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [scopeFormOpen, setScopeFormOpen] = useState(false);

  async function confirmRevoke() {
    if (!revoking) return;
    setRevokeLoading(true);
    try {
      const res = await revokeApiClient(revoking.id);
      toast({ tone: "success", title: res.message });
      setRevoking(null);
      clients.refetch();
    } catch (err) {
      if (err instanceof ApiException && err.statusCode === 404) {
        toast({ tone: "success", title: "El cliente ya no existe." });
        setRevoking(null);
        clients.refetch();
      } else {
        toast({ tone: "error", title: "No se pudo revocar", description: errorMessage(err) });
      }
    } finally {
      setRevokeLoading(false);
    }
  }

  const columns: Column<ApiClient>[] = [
    {
      key: "name",
      header: "Cliente",
      render: (c) => (
        <div>
          <p className="font-medium text-foreground">{c.name}</p>
          <p className="font-mono text-xs text-muted">{c.keyPrefix}…</p>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Estado",
      render: (c) =>
        c.isActive ? (
          <Badge tone="success" dot>Activo</Badge>
        ) : (
          <Badge tone="neutral" dot>Inactivo</Badge>
        ),
    },
    {
      key: "lastUsedAt",
      header: "Último uso",
      render: (c) => (
        <span className="text-muted">
          {c.lastUsedAt ? formatRelativeTime(c.lastUsedAt) : "Nunca usada"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Creado",
      render: (c) => <span className="text-muted">{formatDate(c.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          {canWrite && (
            <button type="button" onClick={() => setScopesClient(c)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label={`Scopes de ${c.name}`}>
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={() => { setEditing(c); setFormOpen(true); }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label={`Editar ${c.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setRevoking(c)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
              aria-label={`Revocar ${c.name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const scopeColumns: Column<ApiScope>[] = [
    { key: "code", header: "Código", render: (s) => <Badge tone="primary">{s.code}</Badge> },
    {
      key: "description",
      header: "Descripción",
      render: (s) => <span className="text-muted">{s.description ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes de API"
        description="Credenciales para integraciones (n8n / agente). El consumo de /integration es externo."
        actions={
          canWrite && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          )
        }
      />

      <Card className="overflow-hidden p-0">
        <DataTable
          columns={columns}
          data={clients.data ?? []}
          loading={clients.loading}
          error={clients.error}
          onRetry={clients.refetch}
          rowKey={(c) => c.id}
          emptyTitle="Sin clientes"
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader>
          <CardTitle>Catálogo de scopes</CardTitle>
          {canScopeWrite && (
            <Button variant="secondary" size="sm" onClick={() => setScopeFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo scope
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable
            columns={scopeColumns}
            data={scopeCatalog}
            loading={scopes.loading}
            error={scopes.error}
            onRetry={scopes.refetch}
            rowKey={(s) => s.id}
            emptyTitle="Sin scopes"
          />
        </CardContent>
      </Card>

      <ApiClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        client={editing}
        scopeCatalog={scopeCatalog}
        onSaved={(result) => {
          clients.refetch();
          if ("apiKey" in result) {
            setCreatedKey(result.apiKey);
            setKnownScopeIds((prev) => ({
              ...prev,
              [result.id]: result.scopes.map((s) => s.id),
            }));
          }
        }}
      />
      <ApiClientKeyDialog apiKey={createdKey} onClose={() => setCreatedKey(null)} />
      <ApiClientScopesDialog
        open={!!scopesClient}
        client={scopesClient}
        scopeCatalog={scopeCatalog}
        currentScopeIds={scopesClient ? knownScopeIds[scopesClient.id] ?? null : null}
        onClose={() => setScopesClient(null)}
        onSaved={(detail) => {
          setKnownScopeIds((prev) => ({
            ...prev,
            [detail.id]: detail.scopes.map((s) => s.id),
          }));
          clients.refetch();
        }}
        onClientGone={() => clients.refetch()}
        onCatalogStale={() => scopes.refetch()}
      />
      <ApiScopeForm open={scopeFormOpen} onClose={() => setScopeFormOpen(false)} onSaved={scopes.refetch} />
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={confirmRevoke}
        loading={revokeLoading}
        title={`Revocar "${revoking?.name ?? ""}"`}
        description="Su API key dejará de funcionar de inmediato."
        confirmLabel="Revocar"
      />
    </div>
  );
}
