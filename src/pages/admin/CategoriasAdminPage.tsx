import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import type { CategoryNode } from "../../lib/api-types";
import {
  useArchiveCategory,
  useCategoriesAdmin,
  useCreateCategory,
  useRestoreCategory,
  useUpdateCategory,
} from "../../hooks/useCategoriesAdmin";

type FlatCat = {
  id: string;
  name: string | null;
  description: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
  depth: number;
  parentId: string | null;
};

function flatten(
  nodes: CategoryNode[],
  depth = 0,
  parentId: string | null = null,
  acc: FlatCat[] = [],
): FlatCat[] {
  for (const n of nodes) {
    acc.push({
      id: n.id,
      name: n.name,
      description: n.description,
      displayOrder: n.displayOrder,
      isActive: n.isActive,
      depth,
      parentId,
    });
    if (n.children?.length) flatten(n.children, depth + 1, n.id, acc);
  }
  return acc;
}

const STAFF = ["admin", "manager", "operator"];
type Form = { name: string; description: string; parentCategoryId: string; displayOrder: string };
const EMPTY: Form = { name: "", description: "", parentCategoryId: "", displayOrder: "" };

export function CategoriasAdminPage() {
  const { role } = useAuth();
  const isStaff = STAFF.includes(role ?? "");
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FlatCat | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: tree = [], isLoading, error } = useCategoriesAdmin(showArchived);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();

  const flat = useMemo(() => flatten(tree), [tree]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? flat.filter((c) => (c.name ?? "").toLowerCase().includes(q)) : flat;
  }, [flat, search]);

  const columns: Column<FlatCat>[] = [
    {
      key: "name",
      header: "Nombre",
      width: 280,
      render: (c) => (
        <span style={{ paddingLeft: c.depth * 16 }} className="font-medium text-ink">
          {c.depth > 0 && <span className="mr-1 text-ink-soft">↳</span>}
          {c.name ?? "—"}
        </span>
      ),
    },
    {
      key: "desc",
      header: "Descripción",
      width: 340,
      render: (c) => <span className="text-ink-soft">{c.description ?? "—"}</span>,
    },
    { key: "order", header: "Orden", width: 90, render: (c) => c.displayOrder ?? "—" },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(c: FlatCat) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      description: c.description ?? "",
      parentCategoryId: c.parentId ?? "",
      displayOrder: c.displayOrder?.toString() ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      parentCategoryId: form.parentCategoryId || null,
      displayOrder: form.displayOrder.trim() === "" ? null : Number(form.displayOrder),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Categoría actualizada" : "Categoría creada");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const parentOptions = flat.filter((c) => c.id !== editing?.id);
  const saving = create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<FlatCat>
        title="Categorías"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(c) => c.id}
        isArchived={(c) => !c.isActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={isAdmin}
        canArchive={isAdmin}
        onAdd={openCreate}
        onEdit={isStaff ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(c) => c.name ?? "esta categoría"}
        onArchive={(c) =>
          archive.mutate(c.id, {
            onSuccess: () => toast.success("Categoría archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(c) =>
          restore.mutate(c.id, {
            onSuccess: () => toast.success("Categoría restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar categoría" : "Nueva categoría"}
        error={formError}
        busy={saving}
        canSubmit={form.name.trim().length >= 1}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre *">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Descripción">
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Categoría padre">
          <Select
            value={form.parentCategoryId}
            onChange={(e) => setForm({ ...form, parentCategoryId: e.target.value })}
          >
            <option value="">— (categoría raíz)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {" ".repeat(c.depth * 2)}
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Orden de aparición">
          <TextInput
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            placeholder="—"
          />
        </Field>
      </EntityDrawer>
    </>
  );
}
