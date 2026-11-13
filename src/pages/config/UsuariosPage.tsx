import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextInput } from "../../components/form";
import { Pencil, Plus, Search, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import type { AdminUser } from "../../lib/api-types";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from "../../lib/roles";
import { formatDateTimeToDate } from "../../lib/format";
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUserName,
  useUpdateUserRole,
  useUsers,
  type Role,
} from "../../hooks/useUsers";

export function UsuariosPage() {
  const { user, role: miRol } = useAuth();
  const esAdmin = miRol === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "operator" as Role,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading, error } = useUsers();
  const create = useCreateUser();
  const updateRole = useUpdateUserRole();
  const updateName = useUpdateUserName();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(
    null,
  );
  const del = useDeleteUser();

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? users.filter(
            (u) =>
              (u.email ?? "").toLowerCase().includes(q) ||
              (u.fullName ?? "").toLowerCase().includes(q),
          )
        : users,
    [users, q],
  );

  function openCreate() {
    setForm({ fullName: "", email: "", password: "", role: "operator" });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    create.mutate(
      { ...form, fullName: form.fullName.trim() },
      {
        onSuccess: () => {
          toast.success("Usuario creado");
          setDrawerOpen(false);
        },
        onError: (e: Error) => setFormError(e.message),
      },
    );
  }

  function saveName() {
    if (!editing || editing.value.trim().length === 0) return;
    updateName.mutate(
      { id: editing.id, fullName: editing.value.trim() },
      {
        onSuccess: () => {
          toast.success("Nombre actualizado");
          setEditing(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Usuarios</h2>
        {esAdmin && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <Plus size={16} />
            Agregar
          </button>
        )}
      </div>

      <div className="relative min-w-48">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="modal-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-surface-high">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-high text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Rol</th>
              <th className="px-4 py-3 text-left font-medium">
                Último ingreso
              </th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-high">
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-ink-soft"
                >
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-ink-soft"
                >
                  No hay usuarios.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-ink">
                      {editing?.id === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            aria-label="Nombre"
                            value={editing.value}
                            maxLength={100}
                            autoFocus
                            onChange={(e) =>
                              setEditing({ id: u.id, value: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName();
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="w-40 rounded-lg border border-surface-highest bg-white px-2 py-1 text-sm outline-none focus:border-primary"
                          />
                          <button
                            onClick={saveName}
                            disabled={
                              editing.value.trim().length === 0 ||
                              updateName.isPending
                            }
                            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-surface-high"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {u.fullName ? (
                            <span className="font-medium">{u.fullName}</span>
                          ) : (
                            <span className="text-ink-soft">Sin nombre</span>
                          )}
                          {esAdmin && (
                            <button
                              aria-label="Editar nombre"
                              title="Editar nombre"
                              onClick={() =>
                                setEditing({
                                  id: u.id,
                                  value: u.fullName ?? "",
                                })
                              }
                              className="rounded p-1 text-ink-soft transition-colors hover:bg-surface-high hover:text-ink"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {u.email ?? "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-ink-soft">
                          (vos)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role ?? ""}
                        disabled={isSelf || updateRole.isPending}
                        onChange={(e) =>
                          updateRole.mutate(
                            { id: u.id, role: e.target.value as Role },
                            {
                              onSuccess: () => toast.success("Rol actualizado"),
                              onError: (err: Error) => toast.error(err.message),
                            },
                          )
                        }
                        className="w-40"
                      >
                        {!u.role && <option value="">— Sin rol</option>}
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {u.lastSignInAt
                        ? formatDateTimeToDate(u.lastSignInAt)
                        : "Nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {!isSelf && (
                          <button
                            onClick={() => setToDelete(u)}
                            title="Eliminar usuario"
                            className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EntityDrawer
        open={drawerOpen}
        title="Nuevo usuario"
        error={formError}
        busy={create.isPending}
        canSubmit={
          form.fullName.trim().length > 0 &&
          form.email.trim().length > 3 &&
          form.password.length >= 8
        }
        submitLabel="Crear usuario"
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre *">
          <TextInput
            value={form.fullName}
            maxLength={100}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Cómo aparece en el sistema, ej: Laura"
            autoFocus
          />
        </Field>
        <Field label="Email *">
          <TextInput
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Contraseña * (mín. 8 caracteres)">
          <TextInput
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="La verá el nuevo usuario para ingresar"
          />
        </Field>
        <Field label="Rol">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-soft">
            {ROLE_DESCRIPTIONS[form.role]}
          </p>
        </Field>
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar usuario"
        danger
        confirmLabel="Eliminar"
        busy={del.isPending}
        message={
          <>
            ¿Seguro que querés eliminar a <strong>{toDelete?.email}</strong>?
            Pierde el acceso al sistema de forma permanente.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete)
            del.mutate(toDelete.id, {
              onSuccess: () => {
                toast.success("Usuario eliminado");
                setToDelete(null);
              },
              onError: (e: Error) => {
                toast.error(e.message);
                setToDelete(null);
              },
            });
        }}
      />
    </div>
  );
}
