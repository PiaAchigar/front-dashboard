import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, TextInput } from "../../components/form";
import { Toggle } from "../../components/Toggle";
import { Pencil, Plus, Search, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import type { WebGalleryItem } from "../../lib/api-types";
import {
  useCreateGalleryItem,
  useDeleteGalleryItem,
  useUpdateGalleryItem,
  useWebGallery,
  type GalleryInput,
} from "../../hooks/useWebGallery";

type Form = { publicUrl: string; alt: string; caption: string; sortOrder: string };
const EMPTY: Form = { publicUrl: "", alt: "", caption: "", sortOrder: "" };
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function GaleriaWebPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WebGalleryItem | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WebGalleryItem | null>(null);

  const { data: items = [], isLoading, error } = useWebGallery();
  const create = useCreateGalleryItem();
  const update = useUpdateGalleryItem();
  const del = useDeleteGalleryItem();

  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? items.filter(
            (i) =>
              (i.caption ?? "").toLowerCase().includes(q) ||
              (i.alt ?? "").toLowerCase().includes(q),
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
  function openEdit(i: WebGalleryItem) {
    setEditing(i);
    setForm({
      publicUrl: i.publicUrl ?? "",
      alt: i.alt ?? "",
      caption: i.caption ?? "",
      sortOrder: i.sortOrder?.toString() ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload: GalleryInput = {
      publicUrl: form.publicUrl.trim() || null,
      alt: form.alt.trim() || null,
      caption: form.caption.trim() || null,
      sortOrder: num(form.sortOrder),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Imagen actualizada" : "Imagen agregada");
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
        <h2 className="font-display text-xl text-ink">Galería</h2>
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
          placeholder="Buscar por título o descripción…"
          className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {(error as Error).message}
        </p>
      )}

      <div className="modal-scroll min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <p className="px-1 py-10 text-center text-sm text-ink-soft">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="px-1 py-10 text-center text-sm text-ink-soft">No hay imágenes.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((i) => (
              <div
                key={i.id}
                className="overflow-hidden rounded-xl border border-surface-high bg-white"
              >
                <div className="aspect-video w-full bg-surface-high">
                  {i.publicUrl ? (
                    <img
                      src={i.publicUrl}
                      alt={i.alt ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-ink-soft">
                      Sin imagen
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium text-ink">
                    {i.caption || i.alt || "Sin título"}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <Toggle
                        active={!!i.isVisible}
                        disabled={update.isPending}
                        onChange={(v) =>
                          update.mutate(
                            { id: i.id, isVisible: v },
                            { onError: (e: Error) => toast.error(e.message) },
                          )
                        }
                        label={i.isVisible ? "Ocultar" : "Mostrar"}
                      />
                      <span>{i.isVisible ? "Visible" : "Oculta"}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(i)}
                        title="Editar"
                        className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                      >
                        <Pencil size={15} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setToDelete(i)}
                          title="Eliminar"
                          className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                        >
                          <Trash size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar imagen" : "Nueva imagen"}
        error={formError}
        busy={saving}
        canSubmit={form.publicUrl.trim().length > 0}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="URL de la imagen *">
          <TextInput
            value={form.publicUrl}
            onChange={(e) => setForm({ ...form, publicUrl: e.target.value })}
            placeholder="https://…"
            autoFocus
          />
        </Field>
        <Field label="Texto alternativo (alt)">
          <TextInput value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
        </Field>
        <Field label="Epígrafe / título">
          <TextInput
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
          />
        </Field>
        <Field label="Orden">
          <TextInput
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
          />
        </Field>
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar imagen"
        danger
        confirmLabel="Eliminar"
        busy={del.isPending}
        message="Esta acción es permanente: la imagen se quita de la galería."
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete)
            del.mutate(toDelete.id, {
              onSuccess: () => {
                toast.success("Imagen eliminada");
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
