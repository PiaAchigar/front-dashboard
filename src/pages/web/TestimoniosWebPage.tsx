import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { Toggle } from "../../components/Toggle";
import { Pencil, Plus, Search, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import type { WebTestimonial } from "../../lib/api-types";
import {
  useCreateTestimonial,
  useDeleteTestimonial,
  useUpdateTestimonial,
  useWebTestimonials,
  type TestimonialInput,
} from "../../hooks/useWebTestimonials";

type Form = { authorName: string; body: string; rating: string };
const EMPTY: Form = { authorName: "", body: "", rating: "5" };

export function TestimoniosWebPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WebTestimonial | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WebTestimonial | null>(null);

  const { data: items = [], isLoading, error } = useWebTestimonials();
  const create = useCreateTestimonial();
  const update = useUpdateTestimonial();
  const del = useDeleteTestimonial();

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? items.filter(
            (t) =>
              (t.authorName ?? "").toLowerCase().includes(q) ||
              (t.body ?? "").toLowerCase().includes(q),
          )
        : items,
    [items, q],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEdit(t: WebTestimonial) {
    setEditing(t);
    setForm({
      authorName: t.authorName ?? "",
      body: t.body ?? "",
      rating: t.rating?.toString() ?? "5",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload: TestimonialInput = {
      authorName: form.authorName.trim() || null,
      body: form.body.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Testimonio actualizado" : "Testimonio agregado");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate({ ...payload, isVisible: true }, handlers);
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Testimonios</h2>
        {isAdmin && (
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
          placeholder="Buscar por autor o texto…"
          className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {(error as Error).message}
        </p>
      )}

      <div className="modal-scroll min-h-0 flex-1 space-y-2 overflow-auto">
        {isLoading ? (
          <p className="px-1 py-10 text-center text-sm text-ink-soft">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-ink-soft">No hay testimonios.</p>
        ) : (
          rows.map((t) => (
            <div
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-surface-high bg-white p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {t.authorName ?? "Anónimo"}
                  {t.rating != null && (
                    <span className="ml-2 text-xs text-amber-500">
                      {"★".repeat(Math.max(0, Math.min(5, t.rating)))}
                    </span>
                  )}
                </p>
                {t.body && <p className="mt-0.5 text-sm text-ink-soft">{t.body}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Toggle
                  active={!!t.isVisible}
                  disabled={update.isPending}
                  onChange={(v) =>
                    update.mutate(
                      { id: t.id, isVisible: v },
                      { onError: (e: Error) => toast.error(e.message) },
                    )
                  }
                  label={t.isVisible ? "Ocultar" : "Mostrar"}
                />
                <button
                  onClick={() => openEdit(t)}
                  title="Editar"
                  className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                >
                  <Pencil size={15} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setToDelete(t)}
                    title="Eliminar"
                    className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                  >
                    <Trash size={15} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar testimonio" : "Nuevo testimonio"}
        error={formError}
        busy={saving}
        canSubmit={form.body.trim().length > 0}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Autor">
          <TextInput
            value={form.authorName}
            onChange={(e) => setForm({ ...form, authorName: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Testimonio *">
          <TextArea
            rows={4}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </Field>
        <Field label="Puntuación">
          <Select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </Select>
        </Field>
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar testimonio"
        danger
        confirmLabel="Eliminar"
        busy={del.isPending}
        message="Esta acción es permanente: el testimonio se quita de la web."
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete)
            del.mutate(toDelete.id, {
              onSuccess: () => {
                toast.success("Testimonio eliminado");
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
