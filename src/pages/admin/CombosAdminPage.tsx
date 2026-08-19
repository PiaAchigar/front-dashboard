import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import { useServices } from "../../hooks/useServices";
import { computeComboFinalPrice, computeComboSubtotal } from "../../lib/combo-pricing";
import {
  useArchiveCombo,
  useCombosAdmin,
  useCreateCombo,
  useDeleteCombo,
  useRestoreCombo,
  useUpdateComboAdmin,
  type ComboInput,
} from "../../hooks/useCombosAdmin";
import type { ComboAdmin } from "../../lib/api-types";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR")}`;

/** Línea en edición: todo string, porque son inputs controlados. */
type DraftLine = {
  serviceId: string;
  sessionsIncluded: string;
  /**
   * Nombre del servicio tal como vino del combo guardado. Sólo se usa para
   * identificar la fila cuando ese servicio ya se archivó y por lo tanto no
   * aparece entre las opciones del <Select> (que solo lista activos): sin
   * esto la fila queda muda y la usuaria no sabe qué está reemplazando.
   */
  serviceName: string | null;
};

type Form = {
  name: string;
  description: string;
  priceType: "fixed" | "percentage";
  priceValue: string;
  validityMonths: string;
  isVisibleWeb: boolean;
  displayOrder: string;
  lines: DraftLine[];
};

const EMPTY: Form = {
  name: "",
  description: "",
  priceType: "fixed",
  priceValue: "",
  validityMonths: "12",
  isVisibleWeb: true,
  displayOrder: "0",
  lines: [],
};

const EMPTY_LINE: DraftLine = { serviceId: "", sessionsIncluded: "", serviceName: null };

/** Una fila del combo: servicio + cuántas sesiones de ese servicio incluye. */
function LineRow({
  line,
  services,
  precio,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  services: { id: string; name: string | null }[];
  precio: number;
  onChange: (l: DraftLine) => void;
  onRemove: () => void;
}) {
  const sesiones = Number(line.sessionsIncluded) || 0;
  // El <Select> sólo lista servicios activos. Si esta línea trae un
  // serviceId que ya no está entre ellos, es porque el servicio se archivó
  // — usamos el nombre guardado para que la fila diga a quién hay que
  // reemplazar en vez de aparecer vacía.
  const isArchivedSelection =
    !!line.serviceId && !services.some((s) => s.id === line.serviceId);

  return (
    <li className="space-y-2 rounded-lg border border-surface-high bg-white p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Field label="Servicio">
            {isArchivedSelection && (
              <p className="mb-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Servicio archivado: <strong>{line.serviceName ?? "sin nombre guardado"}</strong>.
                Elegí un reemplazo.
              </p>
            )}
            <Select
              value={line.serviceId}
              onChange={(e) =>
                onChange({ ...line, serviceId: e.target.value, serviceName: null })
              }
            >
              <option value="">Elegí un servicio…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar servicio"
          className="mt-6 shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
        >
          <Trash size={15} />
        </button>
      </div>
      <div className="flex items-end gap-2">
        <Field
          label="Sesiones"
          help="Cuántas sesiones de ESTE servicio incluye el combo. Cada servicio lleva su propia cantidad."
        >
          <TextInput
            inputMode="numeric"
            value={line.sessionsIncluded}
            onChange={(e) => onChange({ ...line, sessionsIncluded: e.target.value })}
            placeholder="8"
          />
        </Field>
        <p className="pb-2 text-sm text-ink-soft">
          {sesiones > 0 && precio > 0
            ? `${sesiones} × ${money(precio)} = ${money(sesiones * precio)}`
            : "—"}
        </p>
      </div>
    </li>
  );
}

export function CombosAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboAdmin | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: combos = [], isLoading, error } = useCombosAdmin(showArchived);
  const { data: services = [] } = useServices();
  const create = useCreateCombo();
  const update = useUpdateComboAdmin();
  const archive = useArchiveCombo();
  const restore = useRestoreCombo();
  const hardDelete = useDeleteCombo();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [combos, search]);

  const priceById = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.id, s.unitPriceList ?? 0);
    return m;
  }, [services]);

  // Preview en vivo: mismo cálculo que combo-pricing.ts del backend.
  const subtotalPreview = computeComboSubtotal(
    form.lines.map((l) => ({
      servicePrice: priceById.get(l.serviceId) ?? 0,
      sessionsIncluded: Number(l.sessionsIncluded) || 0,
    })),
  );
  const priceValue = form.priceValue.trim() === "" ? null : Number(form.priceValue);
  const finalPreview = computeComboFinalPrice(
    subtotalPreview,
    form.priceType,
    form.priceType === "fixed" ? priceValue : null,
    form.priceType === "percentage" ? priceValue : null,
  );

  const columns: Column<ComboAdmin>[] = [
    {
      key: "name",
      header: "Combo",
      width: 240,
      render: (c) => (
        <div>
          <span className="font-medium text-ink">{c.name ?? "—"}</span>
          {c.hasInactiveService && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              No se publica: tiene un servicio archivado
            </span>
          )}
        </div>
      ),
    },
    {
      key: "servicios",
      header: "Servicios",
      width: 90,
      render: (c) => <span className="text-ink-soft">{c.lines.length}</span>,
    },
    {
      key: "sesiones",
      header: "Sesiones",
      width: 90,
      render: (c) => (
        <span className="text-ink-soft">
          {c.lines.reduce((acc, l) => acc + (l.sessionsIncluded ?? 0), 0)}
        </span>
      ),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      width: 120,
      render: (c) => <span className="text-ink-soft">{money(c.servicesSubtotal)}</span>,
    },
    {
      key: "final",
      header: "Precio combo",
      width: 130,
      render: (c) => <span className="font-medium text-ink">{money(c.finalAmount)}</span>,
    },
    {
      key: "vigencia",
      header: "Vigencia",
      width: 100,
      render: (c) => (
        <span className="text-ink-soft">
          {c.validityMonths != null ? `${c.validityMonths} meses` : "—"}
        </span>
      ),
    },
    {
      key: "web",
      header: "En la web",
      width: 100,
      render: (c) =>
        c.isVisibleWeb ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark">
            Visible
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(c: ComboAdmin) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      description: c.description ?? "",
      priceType: (c.priceType as Form["priceType"]) ?? "fixed",
      priceValue:
        c.priceType === "fixed"
          ? String(c.fixedPrice ?? "")
          : String(c.discountPercentage ?? ""),
      validityMonths: c.validityMonths != null ? String(c.validityMonths) : "12",
      isVisibleWeb: c.isVisibleWeb ?? true,
      displayOrder: c.displayOrder != null ? String(c.displayOrder) : "0",
      lines: c.lines.map((l) => ({
        serviceId: l.serviceId ?? "",
        sessionsIncluded: l.sessionsIncluded != null ? String(l.sessionsIncluded) : "",
        serviceName: l.serviceName ?? null,
      })),
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function buildPayload(): ComboInput {
    const value = form.priceValue.trim() === "" ? null : Number(form.priceValue);
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceType: form.priceType,
      fixedPrice: form.priceType === "fixed" ? value : null,
      discountPercentage: form.priceType === "percentage" ? value : null,
      validityMonths: Number(form.validityMonths) || 0,
      isVisibleWeb: form.isVisibleWeb,
      displayOrder: Number(form.displayOrder) || 0,
      lines: form.lines
        .filter((l) => l.serviceId && Number(l.sessionsIncluded) > 0)
        .map((l) => ({
          serviceId: l.serviceId,
          sessionsIncluded: Number(l.sessionsIncluded),
        })),
    };
  }

  async function save() {
    setFormError(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...buildPayload() });
        toast.success("Combo actualizado");
      } else {
        await create.mutateAsync(buildPayload());
        toast.success("Combo creado");
      }
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = create.isPending || update.isPending;
  // El botón se habilita sólo si el combo puede existir: nombre, al menos un
  // servicio con sesiones, y el precio que su tipo exige.
  const lineasValidas = form.lines.filter(
    (l) => l.serviceId && Number(l.sessionsIncluded) > 0,
  ).length;
  const puedeGuardar =
    form.name.trim().length >= 1 &&
    lineasValidas >= 1 &&
    form.priceValue.trim() !== "" &&
    Number(form.validityMonths) >= 1;

  return (
    <>
      <ResourceManager<ComboAdmin>
        title="Combo"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(c) => c.id}
        isArchived={(c) => c.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        canHardDelete={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(c) => c.name ?? "este combo"}
        hardDeleteName={(c) => c.name ?? "este combo"}
        onArchive={(c) =>
          archive.mutate(c.id, {
            onSuccess: () => toast.success("Combo archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(c) =>
          restore.mutate(c.id, {
            onSuccess: () => toast.success("Combo restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onHardDeletePreview={async () => ({ blocked: false, cascade: {} })}
        onHardDelete={(c) =>
          hardDelete.mutate(c.id, {
            onSuccess: () => toast.success("Combo eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar combo" : "Nuevo combo"}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
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
            rows={4}
            className="resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <div className="flex gap-3">
          <Field
            label="Tipo de precio *"
            help="Precio fijo: el combo cuesta ese monto. Porcentaje: se descuenta ese % del subtotal de los servicios."
          >
            <Select
              value={form.priceType}
              onChange={(e) =>
                setForm({ ...form, priceType: e.target.value as Form["priceType"], priceValue: "" })
              }
            >
              <option value="fixed">Precio fijo ($)</option>
              <option value="percentage">% de descuento</option>
            </Select>
          </Field>
          <Field label={form.priceType === "fixed" ? "Precio del combo *" : "Porcentaje *"}>
            <TextInput
              inputMode="numeric"
              value={form.priceValue}
              onChange={(e) => setForm({ ...form, priceValue: e.target.value })}
              placeholder={form.priceType === "fixed" ? "120000" : "20"}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field
            label="Vigencia (meses) *"
            help="Cuántos meses tiene la clienta para usar las sesiones, contados desde el día que compra el combo."
          >
            <TextInput
              inputMode="numeric"
              value={form.validityMonths}
              onChange={(e) => setForm({ ...form, validityMonths: e.target.value })}
              placeholder="12"
            />
          </Field>
          <Field label="Orden en la web">
            <TextInput
              inputMode="numeric"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              placeholder="0"
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isVisibleWeb}
              onChange={(e) => setForm({ ...form, isVisibleWeb: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Mostrar en la web
          </label>
        </div>

        {/* Servicios del combo: cada uno con su propia cantidad de sesiones */}
        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Servicios y sesiones
          </p>
          {form.lines.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin servicios. Agregá al menos uno.</p>
          ) : (
            <ul className="space-y-2">
              {form.lines.map((l, i) => (
                <LineRow
                  key={i}
                  line={l}
                  services={services}
                  precio={priceById.get(l.serviceId) ?? 0}
                  onChange={(nl) =>
                    setForm({ ...form, lines: form.lines.map((x, idx) => (idx === i ? nl : x)) })
                  }
                  onRemove={() =>
                    setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })
                  }
                />
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              <Plus size={15} />
              Agregar servicio
            </button>
          </div>

          <div className="flex justify-between border-t border-surface-high pt-2 text-sm">
            <span className="text-ink-soft">Subtotal (sesiones sueltas)</span>
            <span className="text-ink">{money(subtotalPreview)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-ink">Precio del combo</span>
            <span className="font-semibold text-ink">{money(finalPreview)}</span>
          </div>
          {finalPreview < subtotalPreview && (
            <p className="text-xs text-ink-soft">
              La clienta ahorra {money(subtotalPreview - finalPreview)}.
            </p>
          )}
          {finalPreview > subtotalPreview && (
            <p className="text-xs text-amber-700">
              El combo sale más caro que las sesiones sueltas. Revisá el precio.
            </p>
          )}
        </div>
      </EntityDrawer>
    </>
  );
}
