import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { MpAccountsSection, MpAccountsDraftSection, type DraftMpAccount } from "./MpAccountsSection";
import type { ProviderAdmin } from "../../lib/api-types";
import {
  useArchiveProvider,
  useCreateProvider,
  useProvidersAdmin,
  useRestoreProvider,
  useUpdateProvider,
} from "../../hooks/useProvidersAdmin";
import { useCreateMpAccountForProvider } from "../../hooks/useProviderMpAccounts";

const STAFF = ["admin", "manager", "operator"];

type Form = {
  fullName: string;
  email: string;
  phone: string;
  dni: string;
  cuit: string;
  specialties: string;
  notes: string;
  address: string;
  postalCode: string;
};

const EMPTY: Form = {
  fullName: "",
  email: "",
  phone: "",
  dni: "",
  cuit: "",
  specialties: "",
  notes: "",
  address: "",
  postalCode: "",
};

export function ProveedorasAdminPage() {
  const { role } = useAuth();
  const isStaff = STAFF.includes(role ?? "");
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [draftAccounts, setDraftAccounts] = useState<DraftMpAccount[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: providers = [], isLoading, error } = useProvidersAdmin(showArchived);
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const archive = useArchiveProvider();
  const restore = useRestoreProvider();
  const createMpForProvider = useCreateMpAccountForProvider();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        (p.fullName ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.dni ?? "").toLowerCase().includes(q),
    );
  }, [providers, search]);

  const columns: Column<ProviderAdmin>[] = [
    {
      key: "name",
      header: "Proveedor",
      width: 220,
      render: (p) => <span className="font-medium text-ink">{p.fullName ?? "—"}</span>,
    },
    {
      key: "email",
      header: "Email",
      width: 240,
      render: (p) => <span className="text-ink-soft">{p.email ?? "—"}</span>,
    },
    { key: "phone", header: "Teléfono", width: 150, render: (p) => p.phone ?? "—" },
    {
      key: "spec",
      header: "Especialidades",
      width: 280,
      render: (p) => <span className="text-ink-soft">{p.specialties ?? "—"}</span>,
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDraftAccounts([]);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(p: ProviderAdmin) {
    setEditing(p);
    setForm({
      fullName: p.fullName ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      dni: p.dni ?? "",
      cuit: p.cuit ?? "",
      specialties: p.specialties ?? "",
      notes: p.notes ?? "",
      address: p.address ?? "",
      postalCode: p.postalCode ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function save() {
    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      dni: form.dni.trim() || null,
      cuit: form.cuit.trim() || null,
      specialties: form.specialties.trim() || null,
      notes: form.notes.trim() || null,
      address: form.address.trim() || null,
      postalCode: form.postalCode.trim() || null,
    };
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success("Proveedor actualizado");
      } else {
        // 1) Crear la proveedora y obtener su UUID. 2) Persistir las cuentas en borrador.
        const created = await create.mutateAsync(payload);
        for (const a of draftAccounts) {
          await createMpForProvider.mutateAsync({
            providerId: created.id,
            alias: a.alias || null,
            cvu: a.cvu || null,
          });
        }
        toast.success("Proveedor creado");
      }
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const saving = submitting || create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<ProviderAdmin>
        title="Proveedor de servicio"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(p) => p.id}
        isArchived={(p) => p.status === "inactive"}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre, email o DNI…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={isAdmin}
        canArchive={isAdmin}
        onAdd={openCreate}
        onEdit={isStaff ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(p) => p.fullName ?? "este proveedor"}
        onArchive={(p) =>
          archive.mutate(p.id, {
            onSuccess: () => toast.success("Proveedor archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(p) =>
          restore.mutate(p.id, {
            onSuccess: () => toast.success("Proveedor restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar proveedor" : "Nuevo proveedor"}
        error={formError}
        busy={saving}
        canSubmit={form.fullName.trim().length >= 1}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre completo *">
          <TextInput
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            autoFocus
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Teléfono">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-3">
          <Field label="DNI">
            <TextInput
              inputMode="numeric"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
            />
          </Field>
          <Field label="CUIT">
            <TextInput value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
          </Field>
        </div>
        <Field label="Especialidades">
          <TextArea
            rows={2}
            value={form.specialties}
            onChange={(e) => setForm({ ...form, specialties: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Dirección">
            <TextInput
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Código postal">
            <TextInput
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notas">
          <TextArea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {editing ? (
          <MpAccountsSection providerId={editing.id} />
        ) : (
          <MpAccountsDraftSection value={draftAccounts} onChange={setDraftAccounts} />
        )}
      </EntityDrawer>
    </>
  );
}
