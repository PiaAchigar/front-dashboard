import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import type { Faq } from "../../lib/api-types";
import {
  useArchiveFaq,
  useCreateFaq,
  useFaqs,
  useRestoreFaq,
  useUpdateFaq,
  type FaqInput,
} from "../../hooks/useFaq";

const STAFF = ["admin", "manager", "operator"];
const CATEGORIES = [
  { value: "", label: "—" },
  { value: "services", label: "Servicios" },
  { value: "products", label: "Productos" },
  { value: "promotions", label: "Promociones" },
  { value: "schedules", label: "Horarios" },
  { value: "pricing", label: "Precios" },
  { value: "general", label: "General" },
];
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter((c) => c.value).map((c) => [c.value, c.label]),
);

type Form = {
  question: string;
  answer: string;
  category: string;
  displayOrder: string;
  keywords: string;
};
const EMPTY: Form = { question: "", answer: "", category: "", displayOrder: "", keywords: "" };
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function FaqWebPage() {
  const { role } = useAuth();
  const isStaff = STAFF.includes(role ?? "");
  const isAdmin = role === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: faqs = [], isLoading, error } = useFaqs(showArchived);
  const create = useCreateFaq();
  const update = useUpdateFaq();
  const archive = useArchiveFaq();
  const restore = useRestoreFaq();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        (f.question ?? "").toLowerCase().includes(q) ||
        (f.answer ?? "").toLowerCase().includes(q),
    );
  }, [faqs, search]);

  const columns: Column<Faq>[] = [
    {
      key: "question",
      header: "Pregunta",
      width: 320,
      render: (f) => <span className="font-medium text-ink">{f.question ?? "—"}</span>,
    },
    {
      key: "category",
      header: "Categoría",
      width: 130,
      render: (f) => (f.category ? (CATEGORY_LABELS[f.category] ?? f.category) : "—"),
    },
    { key: "order", header: "Orden", width: 90, render: (f) => f.displayOrder ?? "—" },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEdit(f: Faq) {
    setEditing(f);
    setForm({
      question: f.question ?? "",
      answer: f.answer ?? "",
      category: f.category ?? "",
      displayOrder: f.displayOrder?.toString() ?? "",
      keywords: (f.keywords ?? []).join(", "),
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload: FaqInput = {
      question: form.question.trim(),
      answer: form.answer.trim() || null,
      category: form.category || null,
      displayOrder: num(form.displayOrder),
      keywords: form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "FAQ actualizada" : "FAQ creada");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<Faq>
        title="Preguntas frecuentes"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(f) => f.id}
        isArchived={(f) => f.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por pregunta o respuesta…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={isAdmin}
        canArchive={isAdmin}
        onAdd={openCreate}
        onEdit={isStaff ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(f) => f.question ?? "esta pregunta"}
        onArchive={(f) =>
          archive.mutate(f.id, {
            onSuccess: () => toast.success("FAQ archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(f) =>
          restore.mutate(f.id, {
            onSuccess: () => toast.success("FAQ restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar FAQ" : "Nueva FAQ"}
        error={formError}
        busy={saving}
        canSubmit={form.question.trim().length >= 1}
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Pregunta *">
          <TextInput
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Respuesta">
          <TextArea
            rows={5}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Categoría">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Orden">
            <TextInput
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Palabras clave (separadas por coma)">
          <TextInput
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            placeholder="láser, depilación, dolor"
          />
        </Field>
      </EntityDrawer>
    </>
  );
}
