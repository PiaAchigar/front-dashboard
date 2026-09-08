import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { can, type Role } from "../../lib/permissions";
import {
  useArchiveTraining,
  useCreateTraining,
  useRestoreTraining,
  useTrainingsAdmin,
  useUpdateTraining,
  type Training,
} from "../../hooks/useTrainingsAdmin";

/** Las tres modalidades que acepta la columna `modality`. */
const MODALIDADES = [
  { value: "", label: "—" },
  { value: "in_person", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Híbrida" },
];

const TAX_OPTIONS = [
  { value: "", label: "—" },
  { value: "VAT21", label: "IVA 21%" },
  { value: "VAT10.5", label: "IVA 10.5%" },
  { value: "exempt", label: "Exento" },
];

const money = (n: number | null) => (n != null ? `$${n.toLocaleString("es-AR")}` : "—");
const num = (s: string) => (s.trim() === "" ? null : Number(s));

type Form = {
  name: string;
  description: string;
  modality: string;
  location: string;
  totalSessions: string;
  durationPerSessionMinutes: string;
  maxParticipants: string;
  prerequisitesText: string;
  includesCertification: boolean;
  certificationTitle: string;
  listPrice: string;
  cashPrice: string;
  taxCategory: string;
  isVisible: boolean;
  isFeatured: boolean;
  webSortOrder: string;
};

const EMPTY: Form = {
  name: "",
  description: "",
  modality: "",
  location: "",
  totalSessions: "",
  durationPerSessionMinutes: "",
  maxParticipants: "",
  prerequisitesText: "",
  includesCertification: false,
  certificationTitle: "",
  listPrice: "",
  cashPrice: "",
  taxCategory: "",
  isVisible: true,
  isFeatured: false,
  webSortOrder: "",
};

/**
 * Las capacitaciones profesionales: instructorados y workshops que Piu Bella
 * dicta a otras profesionales.
 *
 * Viven en su propia tabla (`training`) desde la 1.0.0 y no son servicios: no
 * se agendan como un turno, tienen cupo, sesiones totales y certificación. El
 * backend ya las servía al sitio público y a la pantalla de Sitio Web; esta
 * pantalla es la primera que permite darlas de alta y editarlas.
 */
export function CapacitacionesAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: trainings = [], isLoading, error } = useTrainingsAdmin(showArchived);
  const create = useCreateTraining();
  const update = useUpdateTraining();
  const archive = useArchiveTraining();
  const restore = useRestoreTraining();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainings;
    return trainings.filter((t) => (t.name ?? "").toLowerCase().includes(q));
  }, [trainings, search]);

  const columns: Column<Training>[] = [
    {
      key: "name",
      header: "Capacitación",
      width: 320,
      render: (t) => (
        <div>
          <span className="font-medium text-ink">{t.name ?? "—"}</span>
          {t.includesCertification && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              certifica
            </span>
          )}
        </div>
      ),
    },
    {
      key: "modality",
      header: "Modalidad",
      width: 120,
      render: (t) => MODALIDADES.find((m) => m.value === t.modality)?.label ?? t.modality ?? "—",
    },
    {
      key: "sessions",
      header: "Sesiones",
      width: 100,
      render: (t) => (t.totalSessions != null ? `${t.totalSessions}` : "—"),
    },
    { key: "list", header: "Lista", width: 110, render: (t) => money(t.listPrice) },
    { key: "cash", header: "Efectivo", width: 110, render: (t) => money(t.cashPrice) },
    {
      key: "cupo",
      header: "Cupo",
      width: 90,
      render: (t) => (t.maxParticipants != null ? `${t.maxParticipants}` : "—"),
    },
    {
      key: "web",
      header: "En la web",
      width: 120,
      render: (t) =>
        t.isVisible ? (
          <span className="text-ink-soft">{t.isFeatured ? "Destacada" : "Visible"}</span>
        ) : (
          <span className="text-ink-soft">Oculta</span>
        ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(t: Training) {
    setEditing(t);
    setForm({
      name: t.name ?? "",
      description: t.description ?? "",
      modality: t.modality ?? "",
      location: t.location ?? "",
      totalSessions: t.totalSessions?.toString() ?? "",
      durationPerSessionMinutes: t.durationPerSessionMinutes?.toString() ?? "",
      maxParticipants: t.maxParticipants?.toString() ?? "",
      prerequisitesText: t.prerequisitesText ?? "",
      includesCertification: !!t.includesCertification,
      certificationTitle: t.certificationTitle ?? "",
      listPrice: t.listPrice?.toString() ?? "",
      cashPrice: t.cashPrice?.toString() ?? "",
      taxCategory: t.taxCategory ?? "",
      isVisible: t.isVisible ?? true,
      isFeatured: !!t.isFeatured,
      webSortOrder: t.webSortOrder?.toString() ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function save() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      modality: form.modality || null,
      location: form.location.trim() || null,
      totalSessions: num(form.totalSessions),
      durationPerSessionMinutes: num(form.durationPerSessionMinutes),
      maxParticipants: num(form.maxParticipants),
      prerequisitesText: form.prerequisitesText.trim() || null,
      includesCertification: form.includesCertification,
      // Si no certifica, el título del certificado no significa nada: se
      // limpia en vez de quedar guardado y reaparecer al volver a tildar.
      certificationTitle: form.includesCertification
        ? form.certificationTitle.trim() || null
        : null,
      listPrice: num(form.listPrice),
      cashPrice: num(form.cashPrice),
      taxCategory: form.taxCategory || null,
      isVisible: form.isVisible,
      isFeatured: form.isFeatured,
      webSortOrder: num(form.webSortOrder),
    };

    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      toast.success(editing ? "Capacitación actualizada" : "Capacitación creada");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<Training>
        title="Capacitaciones"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(t) => t.id}
        isArchived={(t) => t.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(t) => t.name ?? "esta capacitación"}
        onArchive={(t) =>
          archive.mutate(t.id, {
            onSuccess: () => toast.success("Capacitación archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(t) =>
          restore.mutate(t.id, {
            onSuccess: () => toast.success("Capacitación restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar capacitación" : "Nueva capacitación"}
        error={formError}
        busy={saving}
        canSubmit={form.name.trim().length >= 1}
        widthClass="max-w-2xl"
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
            rows={5}
            className="resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Modalidad">
            <Select
              value={form.modality}
              onChange={(e) => setForm({ ...form, modality: e.target.value })}
            >
              {MODALIDADES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lugar">
            <TextInput
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="ej: Sede Belgrano"
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Sesiones totales">
            <TextInput
              type="number"
              min={0}
              value={form.totalSessions}
              onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
            />
          </Field>
          <Field label="Duración por sesión (min)">
            <TextInput
              type="number"
              min={0}
              value={form.durationPerSessionMinutes}
              onChange={(e) => setForm({ ...form, durationPerSessionMinutes: e.target.value })}
            />
          </Field>
          <Field label="Cupo máximo">
            <TextInput
              type="number"
              min={0}
              value={form.maxParticipants}
              onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Precio lista">
            <TextInput
              type="number"
              min={0}
              value={form.listPrice}
              onChange={(e) => setForm({ ...form, listPrice: e.target.value })}
            />
          </Field>
          <Field label="Precio efectivo">
            <TextInput
              type="number"
              min={0}
              value={form.cashPrice}
              onChange={(e) => setForm({ ...form, cashPrice: e.target.value })}
            />
          </Field>
          <Field label="IVA">
            <Select
              value={form.taxCategory}
              onChange={(e) => setForm({ ...form, taxCategory: e.target.value })}
            >
              {TAX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Requisitos previos">
          <TextArea
            rows={3}
            className="resize-y"
            value={form.prerequisitesText}
            onChange={(e) => setForm({ ...form, prerequisitesText: e.target.value })}
            placeholder="ej: Instructorado de Pilates completo"
          />
        </Field>

        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <Checkbox
            label="Entrega certificado"
            checked={form.includesCertification}
            onChange={(v) => setForm({ ...form, includesCertification: v })}
          />
          {form.includesCertification && (
            <Field label="Título del certificado">
              <TextInput
                value={form.certificationTitle}
                onChange={(e) => setForm({ ...form, certificationTitle: e.target.value })}
                placeholder="ej: Instructora de Pilates Reformer"
              />
            </Field>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Sitio web</p>
          <Checkbox
            label="Visible en la web"
            checked={form.isVisible}
            onChange={(v) => setForm({ ...form, isVisible: v })}
          />
          <Checkbox
            label="Destacada en el home"
            checked={form.isFeatured}
            onChange={(v) => setForm({ ...form, isFeatured: v })}
          />
          <Field label="Orden de aparición">
            <TextInput
              type="number"
              min={0}
              value={form.webSortOrder}
              onChange={(e) => setForm({ ...form, webSortOrder: e.target.value })}
              placeholder="—"
            />
          </Field>
        </div>
      </EntityDrawer>
    </>
  );
}
